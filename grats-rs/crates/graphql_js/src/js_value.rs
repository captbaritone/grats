//! PORT: Not a graphql-js module. graphql-js coerces GraphQL literals (for
//! example default values) into JavaScript values. This models the values that
//! coercion can produce. `undefined`, which graphql-js uses to mean "no value"
//! or "invalid", is modeled as `None` wherever it can occur.

use indexmap::IndexMap;

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Boolean(bool),
    Number(f64),
    String(String),
    List(Vec<Value>),
    /// graphql-js creates these with `Object.create(null)`. GraphQL names can't
    /// look like array indices, so JavaScript iterates their keys in insertion
    /// order.
    Object(IndexMap<String, Value>),
}

/// JavaScript's `parseInt(string, 10)`.
///
/// Grats creates `IntValue` nodes from TypeScript's normalized numeric literal
/// text, which can be something like `1e+21` or `Infinity`, so this must parse
/// a prefix of the string the way JavaScript does.
pub fn parse_int(string: &str) -> f64 {
    let s = trim_js_whitespace_start(string);
    let (sign, s) = split_sign(s);
    let digits = &s[..s.bytes().take_while(u8::is_ascii_digit).count()];
    if digits.is_empty() {
        return f64::NAN;
    }
    sign * digits.parse::<f64>().expect("Decimal digits should parse")
}

/// JavaScript's `parseFloat(string)`, which parses the longest prefix of the
/// string that is a decimal literal.
pub fn parse_float(string: &str) -> f64 {
    let s = trim_js_whitespace_start(string);
    let (sign, s) = split_sign(s);
    if s.starts_with("Infinity") {
        return sign * f64::INFINITY;
    }
    let bytes = s.as_bytes();
    let count_digits = |from: usize| {
        bytes[from..]
            .iter()
            .take_while(|b| b.is_ascii_digit())
            .count()
    };
    let integer_digits = count_digits(0);
    let mut end = integer_digits;
    let mut fraction_digits = 0;
    if bytes.get(end) == Some(&b'.') {
        fraction_digits = count_digits(end + 1);
        if integer_digits > 0 || fraction_digits > 0 {
            end += 1 + fraction_digits;
        }
    }
    if integer_digits == 0 && fraction_digits == 0 {
        return f64::NAN;
    }
    if matches!(bytes.get(end), Some(b'e' | b'E')) {
        let exponent_sign = usize::from(matches!(bytes.get(end + 1), Some(b'+' | b'-')));
        let exponent_digits = count_digits(end + 1 + exponent_sign);
        if exponent_digits > 0 {
            end += 1 + exponent_sign + exponent_digits;
        }
    }
    sign * s[..end]
        .parse::<f64>()
        .expect("Decimal literal should parse")
}

fn split_sign(s: &str) -> (f64, &str) {
    if let Some(rest) = s.strip_prefix('-') {
        (-1.0, rest)
    } else {
        (1.0, s.strip_prefix('+').unwrap_or(s))
    }
}

/// JavaScript's `StrWhiteSpaceChar`: Unicode `White_Space` except U+0085, plus
/// U+FEFF.
fn trim_js_whitespace_start(s: &str) -> &str {
    s.trim_start_matches(|c: char| (c.is_whitespace() && c != '\u{85}') || c == '\u{FEFF}')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_int_matches_javascript() {
        assert_eq!(parse_int("42"), 42.0);
        assert_eq!(parse_int(" -7"), -7.0);
        assert_eq!(parse_int("+3"), 3.0);
        assert_eq!(parse_int("1e+21"), 1.0);
        assert_eq!(parse_int("12abc"), 12.0);
        assert!(parse_int("Infinity").is_nan());
        assert!(parse_int("").is_nan());
        assert!(parse_int("-").is_nan());
        assert!(parse_int("-0").is_sign_negative());
        assert_eq!(parse_int("99999999999999999999"), 1e20);
    }

    #[test]
    fn parse_float_matches_javascript() {
        assert_eq!(parse_float("1.5"), 1.5);
        assert_eq!(parse_float("1e+21"), 1e21);
        assert_eq!(parse_float("1.2345678901234568e+29"), 1.2345678901234568e29);
        assert_eq!(parse_float("Infinity"), f64::INFINITY);
        assert_eq!(parse_float("-Infinityx"), f64::NEG_INFINITY);
        assert_eq!(parse_float(".5"), 0.5);
        assert_eq!(parse_float("5."), 5.0);
        assert_eq!(parse_float("1e"), 1.0);
        assert_eq!(parse_float("1e+"), 1.0);
        assert_eq!(parse_float("0x1F"), 0.0);
        assert_eq!(parse_float("\u{FEFF} 2"), 2.0);
        assert!(parse_float(".").is_nan());
        assert!(parse_float("e5").is_nan());
        assert!(parse_float("infinity").is_nan());
    }
}
