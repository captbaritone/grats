//! Port of graphql-js `language/characterClasses.ts`.
//!
//! PORT: Each takes an `Option` since graphql-js calls them with `NaN` when
//! reading past the end of a string.

/// ```text
/// WhiteSpace ::
///   - "Horizontal Tab (U+0009)"
///   - "Space (U+0020)"
/// ```
pub fn is_white_space(code: Option<u16>) -> bool {
    code == Some(0x0009) || code == Some(0x0020)
}

/// ```text
/// Digit :: one of
///   - `0` `1` `2` `3` `4` `5` `6` `7` `8` `9`
/// ```
pub fn is_digit(code: Option<u16>) -> bool {
    matches!(code, Some(0x0030..=0x0039))
}

/// ```text
/// Letter :: one of
///   - `A` `B` `C` `D` `E` `F` `G` `H` `I` `J` `K` `L` `M`
///   - `N` `O` `P` `Q` `R` `S` `T` `U` `V` `W` `X` `Y` `Z`
///   - `a` `b` `c` `d` `e` `f` `g` `h` `i` `j` `k` `l` `m`
///   - `n` `o` `p` `q` `r` `s` `t` `u` `v` `w` `x` `y` `z`
/// ```
pub fn is_letter(code: Option<u16>) -> bool {
    matches!(
        code,
        Some(0x0061..=0x007a) // A-Z
            | Some(0x0041..=0x005a) // a-z
    )
}

/// ```text
/// NameStart ::
///   - Letter
///   - `_`
/// ```
pub fn is_name_start(code: Option<u16>) -> bool {
    is_letter(code) || code == Some(0x005f)
}

/// ```text
/// NameContinue ::
///   - Letter
///   - Digit
///   - `_`
/// ```
pub fn is_name_continue(code: Option<u16>) -> bool {
    is_letter(code) || is_digit(code) || code == Some(0x005f)
}
