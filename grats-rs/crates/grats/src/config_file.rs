//! A JSON config file, registered as a source so that diagnostics about it
//! can point into it.

use std::ops::Range;

use graphql_js::language::ast::Location;

use crate::host::Host;
use crate::json_spans::{self, Spans};
use crate::source_table::SourceTable;
use crate::utils::diagnostic_error::{Diagnostic, locationless_err};

pub struct ConfigFile {
    /// The file's path, which a fix's changes name.
    pub path: String,
    /// The file's text, which spans are offsets into.
    pub text: String,
    /// The file's id in the `SourceTable`, which locations refer to.
    pub source: u32,
    pub spans: Spans,
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
            spans: json_spans::scan(&text),
            text,
        }
    }

    /// The location of a byte range in the file.
    pub fn loc(&self, span: &Range<usize>) -> Location {
        Location {
            source: self.source,
            start: self.spans.to_utf16(&self.text, span.start),
            end: self.spans.to_utf16(&self.text, span.end),
        }
    }

    /// The location of the member at `path`, from its key to the end of its
    /// value. If that member isn't written down, as for an option left at its
    /// default, the nearest ancestor which is.
    pub fn locate(&self, path: &[&str]) -> Option<Location> {
        (1..=path.len())
            .rev()
            .find_map(|len| self.spans.member(&path[..len]))
            .map(|span| self.loc(&span))
    }

    /// The location of a 1-based line and column, as a parser reports them,
    /// spanning to the end of the line.
    pub fn at_line_column(&self, line: usize, column: usize) -> Option<Location> {
        let line_start = self
            .text
            .split_inclusive('\n')
            .take(line.checked_sub(1)?)
            .map(str::len)
            .sum::<usize>();
        let line_end = self.text[line_start..]
            .find('\n')
            .map_or(self.text.len(), |end| line_start + end);
        let start = (line_start + column.saturating_sub(1)).min(line_end);
        Some(self.loc(&(start..line_end.max(start + 1).min(self.text.len()))))
    }

    /// An error about the member at `path`.
    pub fn error(&self, path: &[&str], message: String) -> Diagnostic {
        Diagnostic {
            loc: self.locate(path),
            ..locationless_err(message)
        }
    }
}
