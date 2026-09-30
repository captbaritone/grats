//! Port of `src/utils/helpers.ts`.

/// PORT: Declared in `graphql_js`, whose AST nodes carry them.
pub use graphql_js::language::ast::{TsIdentifier, UNTRACKED_ID};

use std::cell::Cell;

thread_local! {
    static I: Cell<TsIdentifier> = const { Cell::new(0) };
}

pub fn unique_id() -> TsIdentifier {
    I.with(|i| {
        let id = i.get();
        i.set(id + 1);
        id
    })
}

pub fn null_throws<T>(value: Option<T>) -> T {
    value.expect(
        "Grats Error. Expected value to be non-nullish. This error represents an error in Grats. Please report it.",
    )
}

/// PORT: Takes the item's `ast_node`, rather than the item.
pub fn ast_node<T>(ast_node: Option<T>) -> T {
    ast_node.expect("Expected item to have astNode")
}

pub fn invariant(condition: bool, message: &str) {
    if !condition {
        panic!(
            "Grats Error. Invariant failed: {message}. This error represents an error in Grats. Please report it."
        );
    }
}

// Chat GPT Converted the Wikipedia pseudocode to TypeScript
/// PORT: Compares UTF-16 code units, as JavaScript indexes strings.
pub fn levenshtein_distance(s: &str, t: &str) -> usize {
    let s: Vec<u16> = s.encode_utf16().collect();
    let t: Vec<u16> = t.encode_utf16().collect();
    let m = s.len();
    let n = t.len();

    // 2D array (m+1) x (n+1)
    let mut d = vec![vec![0; n + 1]; m + 1];

    // source prefixes → empty string
    for (i, row) in d.iter_mut().enumerate().skip(1) {
        row[0] = i;
    }

    // empty source prefix → target prefixes
    for (j, cell) in d[0].iter_mut().enumerate().skip(1) {
        *cell = j;
    }

    for j in 1..=n {
        for i in 1..=m {
            let substitution_cost = if s[i - 1] == t[j - 1] { 0 } else { 1 };

            d[i][j] = (d[i - 1][j] + 1) // deletion
                .min(d[i][j - 1] + 1) // insertion
                .min(d[i - 1][j - 1] + substitution_cost); // substitution
        }
    }

    d[m][n]
}

// Sorts an array IN PLACE by a computed key
pub fn best_match<T: Copy, S: PartialOrd>(arr: &[T], score_fn: impl Fn(T) -> S) -> T {
    arr.iter()
        .copied()
        .reduce(|best, item| {
            if score_fn(item) > score_fn(best) {
                item
            } else {
                best
            }
        })
        .expect("bestMatch requires a non-empty array")
}

#[cfg(test)]
mod tests {
    use super::{best_match, levenshtein_distance};

    #[test]
    fn levenshtein() {
        assert_eq!(levenshtein_distance("kitten", "sitting"), 3);
        assert_eq!(levenshtein_distance("", "abc"), 3);
        assert_eq!(levenshtein_distance("gqlTyp", "gqlType"), 1);
    }

    #[test]
    fn best_match_prefers_first_of_equal_scores() {
        assert_eq!(best_match(&["a", "b", "c"], |_| 0), "a");
        assert_eq!(best_match(&[1, 3, 2], |x| x), 3);
    }
}
