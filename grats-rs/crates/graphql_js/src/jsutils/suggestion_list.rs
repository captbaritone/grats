//! Port of graphql-js `jsutils/suggestionList.ts`.

use indexmap::IndexMap;

use crate::jsutils::natural_compare::natural_compare;

/// Given an invalid input string and a list of valid options, returns a filtered
/// list of valid options sorted based on their similarity with the input.
pub fn suggestion_list<'o>(
    input: &str,
    options: impl IntoIterator<Item = &'o str>,
) -> Vec<&'o str> {
    // PORT: graphql-js collects the options as the keys of an object. Options
    // are GraphQL names, which can't look like array indices, so JavaScript
    // iterates them in insertion order.
    let mut options_by_distance: IndexMap<&'o str, usize> = IndexMap::new();
    let mut lexical_distance = LexicalDistance::new(input);

    let threshold = input.encode_utf16().count() * 2 / 5 + 1;
    for option in options {
        let distance = lexical_distance.measure(option, threshold);
        if let Some(distance) = distance {
            options_by_distance.insert(option, distance);
        }
    }

    let mut keys: Vec<&'o str> = options_by_distance.keys().copied().collect();
    keys.sort_by(|a, b| {
        let distance_diff = options_by_distance[a].cmp(&options_by_distance[b]);
        distance_diff.then_with(|| natural_compare(a, b))
    });
    keys
}

/// Computes the lexical distance between strings A and B.
///
/// The "distance" between two strings is given by counting the minimum number
/// of edits needed to transform string A into string B. An edit can be an
/// insertion, deletion, or substitution of a single character, or a swap of two
/// adjacent characters.
///
/// Includes a custom alteration from Damerau-Levenshtein to treat case changes
/// as a single edit which helps identify mis-cased values with an edit distance
/// of 1.
///
/// This distance can be useful for detecting typos in input or sorting
struct LexicalDistance<'i> {
    input: &'i str,
    input_lower_case: String,
    input_array: Vec<u16>,
    rows: [Vec<usize>; 3],
}

impl<'i> LexicalDistance<'i> {
    fn new(input: &'i str) -> Self {
        let input_lower_case = input.to_lowercase();
        let input_array = string_to_array(&input_lower_case);
        let length = input.encode_utf16().count();
        LexicalDistance {
            input,
            input_lower_case,
            input_array,
            rows: [
                vec![0; length + 1],
                vec![0; length + 1],
                vec![0; length + 1],
            ],
        }
    }

    fn measure(&mut self, option: &str, threshold: usize) -> Option<usize> {
        if self.input == option {
            return Some(0);
        }

        let option_lower_case = option.to_lowercase();

        // Any case change counts as a single edit
        if self.input_lower_case == option_lower_case {
            return Some(1);
        }

        let option_array = string_to_array(&option_lower_case);
        let (mut a, mut b) = (&option_array, &self.input_array);
        if a.len() < b.len() {
            std::mem::swap(&mut a, &mut b);
        }
        let a_length = a.len();
        let b_length = b.len();

        if a_length - b_length > threshold {
            return None;
        }

        let rows = &mut self.rows;
        for (j, cell) in rows[0].iter_mut().enumerate().take(b_length + 1) {
            *cell = j;
        }

        for i in 1..=a_length {
            let up_row = (i - 1) % 3;
            let current_row = i % 3;
            rows[current_row][0] = i;
            let mut smallest_cell = i;
            for j in 1..=b_length {
                let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };

                let mut current_cell = (rows[up_row][j] + 1) // delete
                    .min(rows[current_row][j - 1] + 1) // insert
                    .min(rows[up_row][j - 1] + cost); // substitute

                if i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1] {
                    // transposition
                    let double_diagonal_cell = rows[(i - 2) % 3][j - 2];
                    current_cell = current_cell.min(double_diagonal_cell + 1);
                }

                if current_cell < smallest_cell {
                    smallest_cell = current_cell;
                }

                rows[current_row][j] = current_cell;
            }

            // Early exit, since distance can't go smaller than smallest element of the previous row.
            if smallest_cell > threshold {
                return None;
            }
        }

        let distance = rows[a_length % 3][b_length];
        if distance <= threshold {
            Some(distance)
        } else {
            None
        }
    }
}

/// PORT: JavaScript strings are indexed by UTF-16 code unit.
fn string_to_array(str: &str) -> Vec<u16> {
    str.encode_utf16().collect()
}

#[cfg(test)]
mod tests {
    use super::suggestion_list;

    #[test]
    fn suggests_similar_options() {
        assert_eq!(suggestion_list("", Vec::new()), Vec::<&str>::new());
        assert_eq!(suggestion_list("green", ["greenish"]), ["greenish"]);
        assert_eq!(suggestion_list("aaaa", ["bbbb"]), Vec::<&str>::new());
        assert_eq!(suggestion_list("GREEN", ["green"]), ["green"]);
        assert_eq!(suggestion_list("ab", ["ba"]), ["ba"]);
        assert_eq!(
            suggestion_list("abc", ["a", "ab", "abc"]),
            ["abc", "ab", "a"]
        );
        assert_eq!(
            suggestion_list("a", ["b", "a10", "a2", "a1"]),
            ["a1", "a2", "b"]
        );
    }
}
