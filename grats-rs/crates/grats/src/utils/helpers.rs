use std::borrow::Cow;
use std::cell::Cell;

use graphql_js::language::ast::TsIdentifier;

thread_local! {
    static NEXT_ID: Cell<TsIdentifier> = const { Cell::new(0) };
}

/// Returns an identifier which no other call on this thread has returned.
pub fn unique_id() -> TsIdentifier {
    NEXT_ID.with(|next| next.replace(next.get() + 1))
}

/// The edit distance between `s` and `t`, counted in UTF-16 code units, as
/// JavaScript indexes strings.
pub fn levenshtein_distance(s: &str, t: &str) -> usize {
    let t: Vec<u16> = t.encode_utf16().collect();
    // The distances from the prefix of `s` read so far to each prefix of `t`.
    let mut row: Vec<usize> = (0..=t.len()).collect();
    for (i, s_unit) in s.encode_utf16().enumerate() {
        // The distance between the previous prefixes of `s` and `t`.
        let mut diagonal = row[0];
        row[0] = i + 1;
        for (j, &t_unit) in t.iter().enumerate() {
            let substitution = diagonal + usize::from(s_unit != t_unit);
            diagonal = row[j + 1];
            let deletion = row[j + 1] + 1;
            let insertion = row[j] + 1;
            row[j + 1] = deletion.min(insertion).min(substitution);
        }
    }
    row[t.len()]
}

#[cfg(test)]
mod tests {
    use super::levenshtein_distance;

    #[test]
    fn levenshtein() {
        assert_eq!(levenshtein_distance("kitten", "sitting"), 3);
        assert_eq!(levenshtein_distance("", "abc"), 3);
        assert_eq!(levenshtein_distance("abc", ""), 3);
        assert_eq!(levenshtein_distance("gqlTyp", "gqlType"), 1);
    }

    #[test]
    fn levenshtein_counts_utf16_code_units() {
        // An emoji is two UTF-16 code units.
        assert_eq!(levenshtein_distance("😀", ""), 2);
        assert_eq!(levenshtein_distance("a😀", "a😁"), 1);
    }
}

/// `text` with its line endings normalized to `\n`.
///
/// TypeScript keeps a file's line endings in the text it reads out of a
/// docblock, so a `\r\n` in the source is a `\r\n` in the text. Grats puts
/// that text into the schema, where a stray `\r` ends up inside a description
/// or a deprecation reason: part of the schema a client sees, and a reason
/// for the generated files to differ between a checkout with CRLF endings
/// and one without.
pub fn normalize_newlines(text: &str) -> Cow<'_, str> {
    if !text.contains('\r') {
        return Cow::Borrowed(text);
    }
    let mut normalized = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\r' {
            // A lone `\r` is a line ending too, on systems old enough.
            chars.next_if_eq(&'\n');
            normalized.push('\n');
        } else {
            normalized.push(ch);
        }
    }
    Cow::Owned(normalized)
}

#[cfg(test)]
mod normalize_newlines_tests {
    use super::normalize_newlines;

    #[test]
    fn leaves_text_without_carriage_returns_alone() {
        assert!(matches!(
            normalize_newlines("a\nb"),
            std::borrow::Cow::Borrowed("a\nb")
        ));
    }

    #[test]
    fn normalizes_each_kind_of_line_ending() {
        assert_eq!(normalize_newlines("a\r\nb"), "a\nb");
        assert_eq!(normalize_newlines("a\rb"), "a\nb");
        assert_eq!(normalize_newlines("a\r\n\r\nb"), "a\n\nb");
        assert_eq!(normalize_newlines("a\r"), "a\n");
    }
}
