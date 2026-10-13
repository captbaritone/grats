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
use crate::utils::diagnostic_error::{Diagnostic, located_err};

pub struct ConfigFile {
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
            source: sources.add(path, &text),
            offsets: Utf16Offsets::new(&text),
            text,
        }
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

    /// The location of `part` of the member at `path`. If that member isn't
    /// written down, as for an option left at its default, the whole of the
    /// nearest ancestor which is.
    pub fn locate(&self, path: &[&str], part: Part) -> Option<Location> {
        let parsed = self.parse().ok()?;
        let (prop, exact) = nearest_member(parsed.value.as_ref()?.as_object()?, path)?;
        // Narrowing an ancestor would point at a key or a value the member
        // asked about doesn't have.
        let range = match part {
            Part::Key if exact => prop.name.range(),
            Part::Value if exact => prop.value.range(),
            _ => prop.range,
        };
        Some(self.loc(&(range.start..range.end)))
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

/// The member at `path`, or the nearest ancestor of it which is written down,
/// and whether it's the member itself. A key inside an array isn't
/// addressable, so a path never reaches one.
fn nearest_member<'a, 'p>(
    root: &'p Object<'a>,
    path: &[&str],
) -> Option<(&'p ObjectProp<'a>, bool)> {
    let mut object = root;
    let mut found = None;
    let mut depth = 0;
    for key in path {
        let Some(prop) = object.get(key) else { break };
        found = Some(prop);
        depth += 1;
        match prop.value.as_object() {
            Some(next) => object = next,
            None => break,
        }
    }
    Some((found?, depth == path.len()))
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
