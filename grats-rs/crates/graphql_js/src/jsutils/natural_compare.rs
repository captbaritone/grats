//! Port of graphql-js `jsutils/naturalCompare.ts`.

use std::cmp::Ordering;

/// Returns a number indicating whether a reference string comes before, or after,
/// or is the same as the given string in natural sort order.
///
/// See: https://en.wikipedia.org/wiki/Natural_sort_order
///
/// PORT: Returns an `Ordering` rather than a number whose sign is the
/// ordering. Compares UTF-16 code units, like JavaScript's `charCodeAt`, and
/// accumulates digit runs as `f64`, like JavaScript numbers.
pub fn natural_compare(a_str: &str, b_str: &str) -> Ordering {
    // PORT: The bytes of ASCII text, such as GraphQL names, are its UTF-16
    // code units, so it's compared without encoding it.
    if a_str.is_ascii() && b_str.is_ascii() {
        return compare_code_units(a_str.as_bytes(), b_str.as_bytes());
    }
    let a_str: Vec<u16> = a_str.encode_utf16().collect();
    let b_str: Vec<u16> = b_str.encode_utf16().collect();
    compare_code_units(&a_str, &b_str)
}

fn compare_code_units<T: Copy + Into<u16>>(a_str: &[T], b_str: &[T]) -> Ordering {
    // PORT: `charCodeAt` returns `NaN` past the end of the string, which is
    // not a digit.
    let char_code_at = |s: &[T], index: usize| s.get(index).map(|&code| code.into());
    let mut a_index = 0;
    let mut b_index = 0;

    while a_index < a_str.len() && b_index < b_str.len() {
        let mut a_char = char_code_at(a_str, a_index);
        let mut b_char = char_code_at(b_str, b_index);

        if is_digit(a_char) && is_digit(b_char) {
            let mut a_num = 0.0;
            loop {
                a_index += 1;
                a_num = a_num * 10.0 + f64::from(a_char.unwrap() - DIGIT_0);
                a_char = char_code_at(a_str, a_index);
                if !(is_digit(a_char) && a_num > 0.0) {
                    break;
                }
            }

            let mut b_num = 0.0;
            loop {
                b_index += 1;
                b_num = b_num * 10.0 + f64::from(b_char.unwrap() - DIGIT_0);
                b_char = char_code_at(b_str, b_index);
                if !(is_digit(b_char) && b_num > 0.0) {
                    break;
                }
            }

            if a_num < b_num {
                return Ordering::Less;
            }

            if a_num > b_num {
                return Ordering::Greater;
            }
        } else {
            if a_char < b_char {
                return Ordering::Less;
            }
            if a_char > b_char {
                return Ordering::Greater;
            }
            a_index += 1;
            b_index += 1;
        }
    }

    a_str.len().cmp(&b_str.len())
}

const DIGIT_0: u16 = 48;
const DIGIT_9: u16 = 57;

fn is_digit(code: Option<u16>) -> bool {
    code.is_some_and(|code| (DIGIT_0..=DIGIT_9).contains(&code))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_digit_runs_as_numbers() {
        assert_eq!(natural_compare("a2", "a10"), Ordering::Less);
        assert_eq!(natural_compare("a10", "a2"), Ordering::Greater);
        assert_eq!(natural_compare("a10", "a10"), Ordering::Equal);
    }

    #[test]
    fn compares_other_characters_by_code_unit() {
        assert_eq!(natural_compare("B", "a"), Ordering::Less);
        assert_eq!(natural_compare("ab", "a"), Ordering::Greater);
        // U+FF21 is one UTF-16 code unit, less than the two of U+1F600.
        assert_eq!(natural_compare("\u{FF21}", "\u{1F600}"), Ordering::Greater);
        assert_eq!(natural_compare("a\u{e9}2", "a\u{e9}10"), Ordering::Less);
    }

    #[test]
    fn leading_zeros_end_a_digit_run() {
        // graphql-js reads `0` as a run of its own, so `01` is `0` then `1`.
        assert_eq!(natural_compare("a01", "a1"), Ordering::Less);
        assert_eq!(natural_compare("a00", "a0"), Ordering::Greater);
    }
}
