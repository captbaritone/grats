//! Port of graphql-js `language/characterClasses.ts`.
//!
//! PORT: Only `isWhiteSpace` is ported so far. It takes an `Option` since
//! graphql-js calls it with `NaN` when reading past the end of a string.

/// ```text
/// WhiteSpace ::
///   - "Horizontal Tab (U+0009)"
///   - "Space (U+0020)"
/// ```
pub fn is_white_space(code: Option<u16>) -> bool {
    code == Some(0x0009) || code == Some(0x0020)
}
