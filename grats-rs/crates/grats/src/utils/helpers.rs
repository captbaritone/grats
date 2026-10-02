use std::cell::Cell;

use graphql_js::language::ast::TsIdentifier;

thread_local! {
    static NEXT_ID: Cell<TsIdentifier> = const { Cell::new(0) };
}

/// Returns an identifier which no other call on this thread has returned.
pub fn unique_id() -> TsIdentifier {
    NEXT_ID.with(|next| next.replace(next.get() + 1))
}

pub fn null_throws<T>(value: Option<T>) -> T {
    value.expect(
        "Grats Error. Expected value to be non-nullish. This error represents an error in Grats. Please report it.",
    )
}

pub fn ast_node<T>(ast_node: Option<T>) -> T {
    ast_node.expect("Expected item to have astNode")
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
