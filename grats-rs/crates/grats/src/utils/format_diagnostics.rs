//! PORT: TypeScript's `formatDiagnosticsWithColorAndContext`, which
//! `ReportableDiagnostics` in `src/utils/DiagnosticError.ts` called. It
//! printed a TypeScript error code after the category, which Grats removed.
//!
//! Offsets are UTF-16, like TypeScript's, and so are the columns and
//! underlines. New lines are always `\n`, where TypeScript used the
//! platform's.

use graphql_js::language::ast::Location;
use serde::Serialize;

use crate::source_table::{Source, SourceTable};
use crate::utils::diagnostic_error::{CodeFixAction, Diagnostic};
use crate::utils::path;

const GREY: &str = "\x1b[90m";
const RED: &str = "\x1b[91m";
const YELLOW: &str = "\x1b[93m";
const CYAN: &str = "\x1b[96m";
const GUTTER_STYLE: &str = "\x1b[7m";
const GUTTER_SEPARATOR: &str = " ";
const RESET: &str = "\x1b[0m";
const ELLIPSIS: &str = "...";
const HALF_INDENT: &str = "  ";
const INDENT: &str = "    ";

/// A diagnostic as the TypeScript side reports it: formatted, with its fix
/// if it has one. See `GratsDiagnostic` in `src/utils/DiagnosticError.ts`.
#[derive(Debug, Serialize)]
pub struct ReportableDiagnostic {
    pub formatted: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fix: Option<CodeFixAction>,
}

/// Formats each diagnostic, whose locations refer to `sources`. The files
/// its fix changes are named as the platform writes them, since the
/// TypeScript side writes them.
pub fn reportable_diagnostics(
    diagnostics: Vec<Diagnostic>,
    sources: &SourceTable,
    current_directory: &str,
) -> Vec<ReportableDiagnostic> {
    diagnostics
        .into_iter()
        .map(|diagnostic| {
            let formatted =
                format_diagnostic_with_color_and_context(&diagnostic, sources, current_directory);
            let fix = diagnostic.fix.map(|fix| {
                let mut fix = *fix;
                for change in &mut fix.changes {
                    change.file_name = path::to_native(&change.file_name).to_string();
                }
                fix
            });
            ReportableDiagnostic { formatted, fix }
        })
        .collect()
}

/// Formats an error, with its location and the code there, and its related
/// information. Paths are relative to `current_directory`.
fn format_diagnostic_with_color_and_context(
    diagnostic: &Diagnostic,
    sources: &SourceTable,
    current_directory: &str,
) -> String {
    let mut output = String::new();
    if let Some(loc) = &diagnostic.loc {
        let file = SourceFile::new(&sources.get(loc.source));
        output += &format_location(&file, loc.start, current_directory);
        output += " - ";
    }
    output += &format_color_and_reset("error", RED);
    output += &format_color_and_reset(": ", GREY);
    output += &diagnostic.message_text;
    if let Some(loc) = &diagnostic.loc {
        let file = SourceFile::new(&sources.get(loc.source));
        output += "\n";
        output += &format_code_span(&file, loc, "", RED);
    }
    if let Some(related_information) = &diagnostic.related_information {
        output += "\n";
        for related in related_information {
            let file = SourceFile::new(&sources.get(related.loc.source));
            output += "\n";
            output += HALF_INDENT;
            output += &format_location(&file, related.loc.start, current_directory);
            output += &format_code_span(&file, &related.loc, INDENT, CYAN);
            output += "\n";
            output += INDENT;
            output += &related.message_text;
        }
    }
    output += "\n";
    output
}

/// A location as `path:line:column`, with an absolute path.
pub fn format_location_without_color(sources: &SourceTable, loc: &Location) -> String {
    let file = SourceFile::new(&sources.get(loc.source));
    let (line, character) = file.line_and_character(loc.start);
    format!(
        "{}:{}:{}",
        path::to_native(&file.name),
        line + 1,
        character + 1
    )
}

fn format_color_and_reset(text: &str, format_style: &str) -> String {
    format!("{format_style}{text}{RESET}")
}

/// A source's text as UTF-16, and where its lines start.
struct SourceFile {
    name: String,
    text: Vec<u16>,
    line_starts: Vec<usize>,
}

impl SourceFile {
    fn new(source: &Source) -> Self {
        let text: Vec<u16> = source.body.encode_utf16().collect();
        let line_starts = compute_line_starts(&text);
        SourceFile {
            name: source.name.clone(),
            text,
            line_starts,
        }
    }

    /// Like `getLineAndCharacterOfPosition`.
    fn line_and_character(&self, position: u32) -> (usize, usize) {
        let position = position as usize;
        let line = match self.line_starts.binary_search(&position) {
            Ok(line) => line,
            Err(next) => next - 1,
        };
        (line, position - self.line_starts[line])
    }
}

/// Like `computeLineStarts`: lines end at `\r\n`, `\n`, `\r`, and the line
/// and paragraph separators.
fn compute_line_starts(text: &[u16]) -> Vec<usize> {
    let mut result = Vec::new();
    let mut pos = 0;
    let mut line_start = 0;
    while pos < text.len() {
        let ch = text[pos];
        pos += 1;
        match ch {
            0x0D | 0x0A | 0x2028 | 0x2029 => {
                if ch == 0x0D && text.get(pos) == Some(&0x0A) {
                    pos += 1;
                }
                result.push(line_start);
                line_start = pos;
            }
            _ => {}
        }
    }
    result.push(line_start);
    result
}

fn format_location(file: &SourceFile, start: u32, current_directory: &str) -> String {
    let (first_line, first_line_char) = file.line_and_character(start);
    let mut output = String::new();
    output += &format_color_and_reset(&relative_file_name(&file.name, current_directory), CYAN);
    output += ":";
    output += &format_color_and_reset(&(first_line + 1).to_string(), YELLOW);
    output += ":";
    output += &format_color_and_reset(&(first_line_char + 1).to_string(), YELLOW);
    output
}

/// Like `convertToRelativePath`: sources which aren't files, like GraphQL
/// parsed from docblocks, keep their names.
fn relative_file_name(name: &str, current_directory: &str) -> String {
    if name.starts_with('/') {
        path::relative(current_directory, name)
    } else {
        name.to_string()
    }
}

fn format_code_span(
    file: &SourceFile,
    loc: &Location,
    indent: &str,
    squiggle_color: &str,
) -> String {
    let (first_line, first_line_char) = file.line_and_character(loc.start);
    let (last_line, last_line_char) = file.line_and_character(loc.end);
    let last_line_in_file = file.line_and_character(file.text.len() as u32).0;

    let has_more_than_five_lines = last_line - first_line >= 4;
    let mut gutter_width = (last_line + 1).to_string().len();
    if has_more_than_five_lines {
        gutter_width = gutter_width.max(ELLIPSIS.len());
    }

    let mut context = String::new();
    let mut i = first_line;
    while i <= last_line {
        context += "\n";
        // If the error spans over 5 lines, we'll only show the first 2 and last 2 lines,
        // so we'll skip ahead to the second-to-last line.
        if has_more_than_five_lines && first_line + 1 < i && i < last_line - 1 {
            context += indent;
            context += &format_color_and_reset(&format!("{ELLIPSIS:>gutter_width$}"), GUTTER_STYLE);
            context += GUTTER_SEPARATOR;
            context += "\n";
            i = last_line - 1;
        }

        let line_start = file.line_starts[i];
        let line_end = if i < last_line_in_file {
            file.line_starts[i + 1]
        } else {
            file.text.len()
        };
        let mut line_content = &file.text[line_start..line_end];
        while let Some((&last, rest)) = line_content.split_last() {
            if !is_js_whitespace(last) {
                break;
            }
            line_content = rest;
        }
        // Tabs are replaced by spaces, keeping the columns the same.
        let line_content: Vec<u16> = line_content
            .iter()
            .map(|&unit| {
                if unit == u16::from(b'\t') {
                    u16::from(b' ')
                } else {
                    unit
                }
            })
            .collect();

        // Output the gutter and the actual contents of the line.
        context += indent;
        context += &format_color_and_reset(&format!("{:>gutter_width$}", i + 1), GUTTER_STYLE);
        context += GUTTER_SEPARATOR;
        context += &String::from_utf16_lossy(&line_content);
        context += "\n";

        // Output the gutter and the error span for the line using tildes.
        context += indent;
        context += &format_color_and_reset(&" ".repeat(gutter_width), GUTTER_STYLE);
        context += GUTTER_SEPARATOR;
        context += squiggle_color;
        let slice = |start: usize, end: usize| {
            let end = end.min(line_content.len());
            &line_content[start.min(end)..end]
        };
        if i == first_line {
            // If we're on the last line, then limit it to the last character of the last line.
            // Otherwise, we'll just squiggle the rest of the line, giving 'slice' no end position.
            let last_char_for_line = if i == last_line {
                last_line_char
            } else {
                line_content.len()
            };
            // Whitespace before the error is kept, so that tabs and the like
            // line up.
            let before: Vec<u16> = slice(0, first_line_char)
                .iter()
                .map(|&unit| {
                    if is_js_whitespace(unit) {
                        unit
                    } else {
                        u16::from(b' ')
                    }
                })
                .collect();
            context += &String::from_utf16_lossy(&before);
            context += &"~".repeat(slice(first_line_char, last_char_for_line).len());
        } else if i == last_line {
            context += &"~".repeat(slice(0, last_line_char).len());
        } else {
            // Squiggle the entire line.
            context += &"~".repeat(line_content.len());
        }
        context += RESET;
        i += 1;
    }
    context
}

/// Whether a UTF-16 code unit is whitespace or a line terminator in
/// JavaScript, which `trimEnd` removes and `\S` doesn't match.
fn is_js_whitespace(unit: u16) -> bool {
    matches!(
        unit,
        0x09..=0x0D
            | 0x20
            | 0xA0
            | 0x1680
            | 0x2000..=0x200A
            | 0x2028
            | 0x2029
            | 0x202F
            | 0x205F
            | 0x3000
            | 0xFEFF
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_starts_match_typescript() {
        let text: Vec<u16> = "a\r\nb\nc\rd\u{2028}e".encode_utf16().collect();
        assert_eq!(compute_line_starts(&text), vec![0, 3, 5, 7, 9]);
    }
}
