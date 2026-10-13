//! A JSON config file, registered as a source so that diagnostics about it
//! can point into it.
//!
//! `tsconfig.json` is JSON with comments and trailing commas. Grats reads its
//! values as a `serde_json::Value`, which keeps no positions, so locating a
//! diagnostic parses the text again into `jsonc-parser`'s syntax tree, which
//! records the byte range of every node.

use std::ops::Range;

use graphql_js::language::ast::Location;
use jsonc_parser::ast::{Object, ObjectProp};
use jsonc_parser::common::Ranged;
use jsonc_parser::errors::ParseError;
use jsonc_parser::{CollectOptions, ParseOptions, ParseResult, parse_to_ast};

use crate::files::Utf16Offsets;
use crate::host::Host;
use crate::source_table::SourceTable;
use crate::utils::diagnostic_error::{Diagnostic, TextChange, TextSpan, located_err};

pub struct ConfigFile {
    /// The file's path, which a fix's changes name.
    path: String,
    /// The file's text, which spans are offsets into.
    text: String,
    /// The file's id in the `SourceTable`, which locations refer to.
    source: u32,
    /// Converts the spans' UTF-8 offsets to the UTF-16 ones locations use.
    offsets: Utf16Offsets,
}

impl ConfigFile {
    pub fn read(host: &dyn Host, sources: &SourceTable, path: &str) -> Option<Self> {
        let text = host.read_file(path)?;
        Some(Self::new(sources, path, text))
    }

    pub fn new(sources: &SourceTable, path: &str, text: String) -> Self {
        ConfigFile {
            path: path.to_string(),
            source: sources.add(path, &text),
            offsets: Utf16Offsets::new(&text),
            text,
        }
    }

    pub fn path(&self) -> &str {
        &self.path
    }

    pub fn text(&self) -> &str {
        &self.text
    }

    /// The location of a byte range in the file.
    fn loc(&self, span: &Range<usize>) -> Location {
        Location {
            source: self.source,
            start: self.offsets.to_utf16(span.start as u32),
            end: self.offsets.to_utf16(span.end as u32),
        }
    }

    /// The location of the file's first character, for an error about the
    /// file as a whole.
    pub fn start(&self) -> Location {
        self.loc(&(0..self.text.chars().next().map_or(0, char::len_utf8)))
    }

    fn parse(&self) -> Result<ParseResult<'_>, ParseError> {
        parse_to_ast(
            &self.text,
            &CollectOptions::default(),
            &ParseOptions::default(),
        )
    }

    /// The location of `part` of the member at `path`, or `None` if the
    /// config doesn't write that member down. A caller which wants to point
    /// somewhere regardless says where itself, since what to fall back to
    /// depends on what the error is about.
    pub fn locate(&self, path: &[&str], part: Part) -> Option<Location> {
        let parsed = self.parse().ok()?;
        let prop = member(parsed.value.as_ref()?.as_object()?, path)?;
        let range = match part {
            Part::Entry => prop.range,
            Part::Key => prop.name.range(),
            Part::Value => prop.value.range(),
        };
        Some(self.loc(&(range.start..range.end)))
    }

    /// A change which gives the member `key` of the object at `path` the value
    /// `value`, replacing what it's set to or inserting the member. `None` if
    /// the config has no object at `path`, since then there's nowhere to put
    /// it.
    ///
    /// Editing only the member leaves the rest of the file, comments and
    /// formatting included, exactly as it was written.
    pub fn set_member(&self, path: &[&str], key: &str, value: &str) -> Option<TextChange> {
        let parsed = self.parse().ok()?;
        let root = parsed.value.as_ref()?.as_object()?;
        let object = match path {
            [] => root,
            _ => member(root, path)?.value.as_object()?,
        };
        let (span, text) = match object.get(key) {
            Some(prop) => {
                let range = prop.value.range();
                (range.start..range.end, value.to_string())
            }
            None => {
                // Indent the new member like the first one, or one level in
                // from the line the object opens on.
                let first = object.properties.first().map(|prop| prop.range.start);
                let indent = line_indent(&self.text, first.unwrap_or(object.range.start));
                let (indent, trailing) = match first {
                    Some(_) => (indent, ","),
                    None => (format!("{indent}  "), ""),
                };
                let at = object.range.start + 1;
                (at..at, format!("\n{indent}\"{key}\": {value}{trailing}"))
            }
        };
        let start = self.offsets.to_utf16(span.start as u32);
        Some(TextChange {
            span: TextSpan {
                start,
                length: self.offsets.to_utf16(span.end as u32) - start,
            },
            new_text: text,
        })
    }

    /// Why the file doesn't parse, and where, or `None` if it parses. The
    /// reason carries no position, since the location gives it.
    pub fn syntax_error(&self) -> Option<(String, Location)> {
        let error = self.parse().err()?;
        let span = error.range();
        Some((error.kind().to_string(), self.loc(&(span.start..span.end))))
    }

    /// An error about `part` of the member at `path`.
    pub fn error(&self, path: &[&str], part: Part, message: String) -> Diagnostic {
        located_err(self.locate(path, part), message)
    }
}

/// Which part of a member a diagnostic points at. Like `tsc`, an error names
/// only what's wrong: the key where the option shouldn't be there at all, the
/// value where the option is fine but what it's set to isn't.
#[derive(Debug, Clone, Copy)]
pub enum Part {
    /// The key, the colon and the value.
    Entry,
    /// The key, in the quotes it's written with.
    Key,
    /// What the option is set to.
    Value,
}

/// The member at `path`. A key inside an array isn't addressable, so a path
/// only ever walks objects.
fn member<'a, 'p>(root: &'p Object<'a>, path: &[&str]) -> Option<&'p ObjectProp<'a>> {
    let (key, ancestors) = path.split_last()?;
    let mut object = root;
    for ancestor in ancestors {
        object = object.get(ancestor)?.value.as_object()?;
    }
    object.get(key)
}

/// The indentation of the line `offset` falls on.
fn line_indent(text: &str, offset: usize) -> String {
    let line_start = text[..offset].rfind('\n').map_or(0, |index| index + 1);
    text[line_start..offset]
        .chars()
        .take_while(|ch| *ch == ' ' || *ch == '\t')
        .collect()
}

/// An error about `part` of the member at `path` of the config at
/// `config_path`, located in it when it can be read.
pub fn config_error(
    host: &dyn Host,
    sources: &SourceTable,
    config_path: &str,
    path: &[&str],
    part: Part,
    message: String,
) -> Diagnostic {
    located_err(
        ConfigFile::read(host, sources, config_path).and_then(|file| file.locate(path, part)),
        message,
    )
}
