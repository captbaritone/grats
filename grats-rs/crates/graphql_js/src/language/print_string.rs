//! Port of graphql-js `language/printString.ts`.

/// Prints a string as a GraphQL StringValue literal. Replaces control characters
/// and excluded characters (" U+0022 and \\ U+005C) with escape sequences.
pub fn print_string(str: &str) -> String {
    let mut result = String::with_capacity(str.len() + 2);
    result.push('"');
    for c in str.chars() {
        match escape_sequence(c) {
            Some(escaped) => result.push_str(&escaped),
            None => result.push(c),
        }
    }
    result.push('"');
    result
}

// PORT: graphql-js matches `/[\x00-\x1f\x22\x5c\x7f-\x9f]/g` and looks the
// replacement up in a table. The table is expressed as a match instead.
fn escape_sequence(c: char) -> Option<String> {
    match c {
        '\u{0008}' => Some("\\b".to_string()),
        '\t' => Some("\\t".to_string()),
        '\n' => Some("\\n".to_string()),
        '\u{000C}' => Some("\\f".to_string()),
        '\r' => Some("\\r".to_string()),
        '"' => Some("\\\"".to_string()),
        '\\' => Some("\\\\".to_string()),
        '\u{0000}'..='\u{001F}' | '\u{007F}'..='\u{009F}' => Some(format!("\\u{:04X}", c as u32)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::print_string;

    #[test]
    fn prints_simple_strings() {
        assert_eq!(print_string("hello world"), "\"hello world\"");
    }

    #[test]
    fn escapes_quotes_and_backslashes() {
        assert_eq!(print_string("\"\\"), "\"\\\"\\\\\"");
    }

    #[test]
    fn escapes_control_characters() {
        assert_eq!(
            print_string("\u{0000}\u{0008}\t\n\u{000B}\u{000C}\r\u{001F}\u{007F}\u{009F}"),
            "\"\\u0000\\b\\t\\n\\u000B\\f\\r\\u001F\\u007F\\u009F\""
        );
    }

    #[test]
    fn does_not_escape_other_unicode() {
        assert_eq!(print_string("\u{00A0}\u{1F600}"), "\"\u{00A0}\u{1F600}\"");
    }
}
