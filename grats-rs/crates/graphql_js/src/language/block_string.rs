//! Port of graphql-js `language/blockString.ts`.
//!
//! PORT: Only `printBlockString` is ported, since Grats never parses GraphQL
//! in Rust yet.

use super::character_classes::is_white_space;

/// Print a block string in the indented block form by adding a leading and
/// trailing blank line. However, if a block string starts with whitespace and is
/// a single-line, adding a leading blank line would strip that whitespace.
///
/// PORT: graphql-js also accepts `{ minimize }`, which Grats never passes.
pub fn print_block_string(value: &str) -> String {
    let escaped_value = value.replace("\"\"\"", "\\\"\"\"");

    // Expand a block string's raw value into independent lines.
    let lines = split_lines(&escaped_value);
    let is_single_line = lines.len() == 1;

    // If common indentation is found we can fix some of those cases by adding leading new line
    let force_leading_new_line = lines.len() > 1
        && lines[1..]
            .iter()
            .all(|line| line.is_empty() || is_white_space(first_code_unit(line)));

    // Trailing triple quotes just looks confusing but doesn't force trailing new line
    let has_trailing_triple_quotes = escaped_value.ends_with("\\\"\"\"");

    // Trailing quote (single or double) or slash forces trailing new line
    let has_trailing_quote = value.ends_with('"') && !has_trailing_triple_quotes;
    let has_trailing_slash = value.ends_with('\\');
    let force_trailing_newline = has_trailing_quote || has_trailing_slash;

    let print_as_multiple_lines =
        // add leading and trailing new lines only if it improves readability
        !is_single_line
            // PORT: `value.length` counts UTF-16 code units.
            || value.encode_utf16().count() > 70
            || force_trailing_newline
            || force_leading_new_line
            || has_trailing_triple_quotes;

    let mut result = String::new();

    // Format a multi-line block quote to account for leading space.
    let skip_leading_new_line = is_single_line && is_white_space(first_code_unit(value));
    if (print_as_multiple_lines && !skip_leading_new_line) || force_leading_new_line {
        result.push('\n');
    }

    result.push_str(&escaped_value);
    if print_as_multiple_lines || force_trailing_newline {
        result.push('\n');
    }

    format!("\"\"\"{result}\"\"\"")
}

// PORT: `str.split(/\r\n|[\n\r]/g)`.
fn split_lines(str: &str) -> Vec<&str> {
    let mut lines = Vec::new();
    let mut start = 0;
    let bytes = str.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'\r' => {
                lines.push(&str[start..i]);
                i += if bytes.get(i + 1) == Some(&b'\n') {
                    2
                } else {
                    1
                };
                start = i;
            }
            b'\n' => {
                lines.push(&str[start..i]);
                i += 1;
                start = i;
            }
            _ => i += 1,
        }
    }
    lines.push(&str[start..]);
    lines
}

// PORT: `str.charCodeAt(0)`, which is `NaN` for an empty string.
fn first_code_unit(str: &str) -> Option<u16> {
    str.encode_utf16().next()
}

#[cfg(test)]
mod tests {
    use super::print_block_string;

    // Cases from graphql-js `language/__tests__/blockString-test.ts`.

    #[test]
    fn does_not_escape_characters() {
        let str = "\" \\ / \u{0008} \u{000C} \n \r \t";
        assert_eq!(print_block_string(str), format!("\"\"\"\n{str}\n\"\"\""));
    }

    #[test]
    fn by_default_print_block_strings_as_single_line() {
        assert_eq!(print_block_string("one liner"), "\"\"\"one liner\"\"\"");
    }

    #[test]
    fn by_default_print_block_strings_ending_with_triple_quotation_as_multi_line() {
        assert_eq!(
            print_block_string("triple quotation \"\"\""),
            "\"\"\"\ntriple quotation \\\"\"\"\n\"\"\""
        );
    }

    #[test]
    fn correctly_prints_single_line_with_leading_space() {
        assert_eq!(
            print_block_string("    space-led string"),
            "\"\"\"    space-led string\"\"\""
        );
    }

    #[test]
    fn correctly_prints_single_line_with_leading_space_and_trailing_quotation() {
        assert_eq!(
            print_block_string("    space-led value \"quoted string\""),
            "\"\"\"    space-led value \"quoted string\"\n\"\"\""
        );
    }

    #[test]
    fn correctly_prints_single_line_with_trailing_backslash() {
        assert_eq!(
            print_block_string("backslash \\"),
            "\"\"\"\nbackslash \\\n\"\"\""
        );
    }

    #[test]
    fn correctly_prints_multi_line_with_internal_indent() {
        assert_eq!(
            print_block_string("no indent\n with indent"),
            "\"\"\"\nno indent\n with indent\n\"\"\""
        );
    }

    #[test]
    fn correctly_prints_string_with_a_first_line_indentation() {
        let str = "    first  \n  line     \nindentation\n     string";
        assert_eq!(print_block_string(str), format!("\"\"\"\n{str}\n\"\"\""));
    }

    #[test]
    fn prints_long_single_lines_as_multi_line() {
        let str = "a".repeat(71);
        assert_eq!(print_block_string(&str), format!("\"\"\"\n{str}\n\"\"\""));
        // Length is measured in UTF-16 code units, like `String.length`.
        let str = "\u{1F600}".repeat(35);
        assert_eq!(print_block_string(&str), format!("\"\"\"{str}\"\"\""));
        let str = "\u{1F600}".repeat(36);
        assert_eq!(print_block_string(&str), format!("\"\"\"\n{str}\n\"\"\""));
    }

    #[test]
    fn splits_lines_like_graphql_js() {
        assert_eq!(
            print_block_string("a\r\n b\r c"),
            "\"\"\"\na\r\n b\r c\n\"\"\""
        );
    }
}
