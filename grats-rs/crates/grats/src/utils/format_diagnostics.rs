//! Formats diagnostics like TypeScript's `formatDiagnosticsWithColorAndContext`,
//! without its error codes.
//!
//! Offsets are UTF-16, like TypeScript's, and so are the columns and
//! underlines. New lines are always `\n`, where TypeScript used the
//! platform's.

use std::fmt::Display;

use graphql_js::language::ast::Location;
use serde::Serialize;

use crate::source_table::{Source, SourceTable};
use crate::utils::diagnostic_error::{CodeFixAction, Diagnostic};
use crate::utils::path;

const GREY: &str = "\x1b[90m";
const BLUE: &str = "\x1b[94m";
const RED: &str = "\x1b[91m";
const YELLOW: &str = "\x1b[93m";
const CYAN: &str = "\x1b[96m";
const GUTTER_STYLE: &str = "\x1b[7m";
const GUTTER_SEPARATOR: &str = " ";
const RESET: &str = "\x1b[0m";
const ELLIPSIS: &str = "...";
const HALF_INDENT: &str = "  ";
const INDENT: &str = "    ";
const TAB: u16 = b'\t' as u16;
const SPACE: u16 = b' ' as u16;

/// A diagnostic as JavaScript reports it: formatted, with its fix if it has
/// one.
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
pub fn format_diagnostic_with_color_and_context(
    diagnostic: &Diagnostic,
    sources: &SourceTable,
    current_directory: &str,
) -> String {
    let located = diagnostic
        .loc
        .map(|loc| (loc, SourceFile::new(&sources.get(loc.source))));
    let mut output = String::new();
    if let Some((loc, file)) = &located {
        output += &format_location(file, loc.start, current_directory);
        output += " - ";
    }
    output += &colored("error", RED);
    output += &colored(": ", GREY);
    output += &diagnostic.message_text;
    if let Some((loc, file)) = &located {
        output += "\n";
        output += &format_code_span(file, loc, "", RED);
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

/// Like `format_diagnostic_with_color_and_context`, without the color, for
/// the playground.
pub fn format_diagnostic_with_context(
    diagnostic: &Diagnostic,
    sources: &SourceTable,
    current_directory: &str,
) -> String {
    strip_color(&format_diagnostic_with_color_and_context(
        diagnostic,
        sources,
        current_directory,
    ))
}

/// Removes the escape sequences which set the color.
fn strip_color(text: &str) -> String {
    let mut stripped = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find("\x1b[") {
        stripped += &rest[..start];
        let sequence = &rest[start..];
        let end = sequence
            .find('m')
            .expect("Expected the escape sequence to end");
        rest = &sequence[end + 1..];
    }
    stripped += rest;
    stripped
}

/// Formats a message without a location, like those of watch mode.
pub fn format_message_with_color(message_text: &str) -> String {
    format!(
        "{}{}{message_text}\n",
        colored("message", BLUE),
        colored(": ", GREY)
    )
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

fn colored(text: impl Display, style: &str) -> String {
    format!("{style}{text}{RESET}")
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
        // The first line starts at 0, so there's always a line at or before
        // `position`.
        let line = self.line_starts.partition_point(|&start| start <= position) - 1;
        (line, position - self.line_starts[line])
    }

    /// The text of line `line`, including its line terminator.
    fn line(&self, line: usize) -> &[u16] {
        let end = self
            .line_starts
            .get(line + 1)
            .copied()
            .unwrap_or(self.text.len());
        &self.text[self.line_starts[line]..end]
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
    let (line, character) = file.line_and_character(start);
    format!(
        "{}:{}:{}",
        colored(relative_file_name(&file.name, current_directory), CYAN),
        colored(line + 1, YELLOW),
        colored(character + 1, YELLOW)
    )
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

    let has_more_than_five_lines = last_line - first_line >= 4;
    let mut gutter_width = (last_line + 1).to_string().len();
    if has_more_than_five_lines {
        gutter_width = gutter_width.max(ELLIPSIS.len());
    }

    let mut context = String::new();
    for i in first_line..=last_line {
        // If the error spans over 5 lines, we'll only show the first 2 and
        // last 2 lines, with an ellipsis in between.
        if has_more_than_five_lines && first_line + 1 < i && i < last_line - 1 {
            if i == first_line + 2 {
                context += "\n";
                context += indent;
                context += &colored(format_args!("{ELLIPSIS:>gutter_width$}"), GUTTER_STYLE);
                context += GUTTER_SEPARATOR;
            }
            continue;
        }

        // Trailing whitespace is removed, and tabs are replaced by spaces,
        // keeping the columns the same.
        let line = file.line(i);
        let end = line
            .iter()
            .rposition(|&unit| !is_js_whitespace(unit))
            .map_or(0, |last| last + 1);
        let line_content: Vec<u16> = line[..end]
            .iter()
            .map(|&unit| if unit == TAB { SPACE } else { unit })
            .collect();

        // Output the gutter and the actual contents of the line.
        context += "\n";
        context += indent;
        context += &colored(format_args!("{:>gutter_width$}", i + 1), GUTTER_STYLE);
        context += GUTTER_SEPARATOR;
        context += &String::from_utf16_lossy(&line_content);
        context += "\n";

        // Output the gutter and the error span for the line using tildes.
        context += indent;
        context += &colored(" ".repeat(gutter_width), GUTTER_STYLE);
        context += GUTTER_SEPARATOR;
        context += squiggle_color;
        // The error's first line is squiggled from where it starts, and its
        // last line up to where it ends.
        let squiggle_start = if i == first_line { first_line_char } else { 0 };
        let squiggle_end = if i == last_line {
            last_line_char
        } else {
            line_content.len()
        };
        // Whitespace before the error is kept, so that tabs and the like line
        // up.
        let before: Vec<u16> = line_content[..squiggle_start.min(line_content.len())]
            .iter()
            .map(|&unit| if is_js_whitespace(unit) { unit } else { SPACE })
            .collect();
        context += &String::from_utf16_lossy(&before);
        let squiggle_len = squiggle_end
            .min(line_content.len())
            .saturating_sub(squiggle_start);
        context += &"~".repeat(squiggle_len);
        context += RESET;
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
    use crate::utils::diagnostic_error::DiagnosticRelatedInformation;

    #[test]
    fn formats_with_color() {
        let sources = SourceTable::default();
        let source = sources.add("/project/src/a.ts", "let a =\tb;\nfoo\n");
        let diagnostic = Diagnostic {
            message_text: "Bad.".to_string(),
            loc: Some(Location {
                source,
                start: 8,
                end: 9,
            }),
            related_information: Some(vec![DiagnosticRelatedInformation {
                message_text: "Here.".to_string(),
                loc: Location {
                    source,
                    start: 11,
                    end: 14,
                },
            }]),
            fix: None,
        };
        let formatted = format_diagnostic_with_color_and_context(&diagnostic, &sources, "/project");
        assert_eq!(
            formatted,
            "\x1b[96msrc/a.ts\x1b[0m:\x1b[93m1\x1b[0m:\x1b[93m9\x1b[0m - \x1b[91merror\x1b[0m\x1b[90m: \x1b[0mBad.\n\
             \n\
             \x1b[7m1\x1b[0m let a = b;\n\
             \x1b[7m \x1b[0m \x1b[91m        ~\x1b[0m\n\
             \n  \x1b[96msrc/a.ts\x1b[0m:\x1b[93m2\x1b[0m:\x1b[93m1\x1b[0m\n\
             \x20   \x1b[7m2\x1b[0m foo\n\
             \x20   \x1b[7m \x1b[0m \x1b[96m~~~\x1b[0m\n\
             \x20   Here.\n"
        );
        assert_eq!(
            format_message_with_color("Hi."),
            "\x1b[94mmessage\x1b[0m\x1b[90m: \x1b[0mHi.\n"
        );
        assert_eq!(
            format_location_without_color(&sources, &diagnostic.loc.unwrap()),
            "/project/src/a.ts:1:9"
        );
    }

    #[test]
    fn line_starts_match_typescript() {
        let text: Vec<u16> = "a\r\nb\nc\rd\u{2028}e".encode_utf16().collect();
        assert_eq!(compute_line_starts(&text), vec![0, 3, 5, 7, 9]);
    }
}
