//! Port of graphql-js `language/lexer.ts`.
//!
//! PORT: JavaScript strings are sequences of UTF-16 code units, which all
//! offsets count. So the lexer reads the source's body as UTF-16 code units,
//! and `charCodeAt` past the end of the body (`NaN`) is `None`.

use super::ast::Token;
use super::block_string::dedent_block_string_lines;
use super::character_classes::{is_digit, is_name_continue, is_name_start};
use super::source::Source;
use super::token_kind::TokenKind;
use crate::error::graphql_error::GraphQLError;
use crate::error::syntax_error::syntax_error;

/// Given a Source object, creates a Lexer for that source.
/// A Lexer is a stateful stream generator in that every time
/// it is advanced, it returns the next token in the Source. Assuming the
/// source lexes, the final Token emitted by the lexer will be of kind
/// EOF, after which the lexer will repeatedly return the same EOF token
/// whenever called.
pub struct Lexer<'s> {
    pub source: Source<'s>,
    /// PORT: The source's body as UTF-16 code units.
    body: Vec<u16>,
    /// PORT: Every token read so far, including ignored tokens, in the order
    /// graphql-js links them.
    tokens: Vec<Token>,
    /// The previously focused non-ignored token.
    ///
    /// PORT: An index into `tokens`.
    last_token: usize,
    /// The currently focused non-ignored token.
    ///
    /// PORT: An index into `tokens`.
    token: usize,
    /// The (1-indexed) line containing the current token.
    line: usize,
    /// The character offset at which the current line begins.
    line_start: usize,
}

impl<'s> Lexer<'s> {
    pub fn new(source: Source<'s>) -> Self {
        let start_of_file_token = Token::new(TokenKind::Sof, 0, 0, 0, 0, None);
        Lexer {
            source,
            body: source.body.encode_utf16().collect(),
            tokens: vec![start_of_file_token],
            last_token: 0,
            token: 0,
            line: 1,
            line_start: 0,
        }
    }

    /// The previously focused non-ignored token.
    pub fn last_token(&self) -> &Token {
        &self.tokens[self.last_token]
    }

    /// The currently focused non-ignored token.
    pub fn token(&self) -> &Token {
        &self.tokens[self.token]
    }

    /// Advances the token stream to the next non-ignored token.
    pub fn advance(&mut self) -> Result<&Token, GraphQLError> {
        self.last_token = self.token;
        self.token = self.lookahead_index()?;
        Ok(self.token())
    }

    /// Looks ahead and returns the next non-ignored token, but does not change
    /// the state of Lexer.
    pub fn lookahead(&mut self) -> Result<&Token, GraphQLError> {
        let token = self.lookahead_index()?;
        Ok(&self.tokens[token])
    }

    fn lookahead_index(&mut self) -> Result<usize, GraphQLError> {
        let mut token = self.token;
        if self.tokens[token].kind != TokenKind::Eof {
            loop {
                if token + 1 == self.tokens.len() {
                    // Read the next token and form a link in the token linked-list.
                    let next_token = read_next_token(self, self.tokens[token].end)?;
                    self.tokens.push(next_token);
                }
                token += 1;
                if self.tokens[token].kind != TokenKind::Comment {
                    break;
                }
            }
        }
        Ok(token)
    }
}

pub fn is_punctuator_token_kind(kind: TokenKind) -> bool {
    matches!(
        kind,
        TokenKind::Bang
            | TokenKind::Dollar
            | TokenKind::Amp
            | TokenKind::ParenL
            | TokenKind::ParenR
            | TokenKind::Spread
            | TokenKind::Colon
            | TokenKind::Equals
            | TokenKind::At
            | TokenKind::BracketL
            | TokenKind::BracketR
            | TokenKind::BraceL
            | TokenKind::Pipe
            | TokenKind::BraceR
    )
}

/// A Unicode scalar value is any Unicode code point except surrogate code
/// points. In other words, the inclusive ranges of values 0x0000 to 0xD7FF and
/// 0xE000 to 0x10FFFF.
///
/// SourceCharacter ::
///   - "Any Unicode scalar value"
fn is_unicode_scalar_value(code: i32) -> bool {
    (0x0000..=0xd7ff).contains(&code) || (0xe000..=0x10ffff).contains(&code)
}

/// The GraphQL specification defines source text as a sequence of unicode scalar
/// values (which Unicode defines to exclude surrogate code points). However
/// JavaScript defines strings as a sequence of UTF-16 code units which may
/// include surrogates. A surrogate pair is a valid source character as it
/// encodes a supplementary code point (above U+FFFF), but unpaired surrogate
/// code points are not valid source characters.
fn is_supplementary_code_point(body: &[u16], location: usize) -> bool {
    is_leading_surrogate(code_at(body, location))
        && is_trailing_surrogate(code_at(body, location + 1))
}

fn is_leading_surrogate(code: i32) -> bool {
    (0xd800..=0xdbff).contains(&code)
}

fn is_trailing_surrogate(code: i32) -> bool {
    (0xdc00..=0xdfff).contains(&code)
}

/// PORT: `body.charCodeAt(position)`.
fn char_code_at(body: &[u16], position: usize) -> Option<u16> {
    body.get(position).copied()
}

/// PORT: `body.charCodeAt(position)` where it's compared as a number, with
/// `NaN` as -1, which no comparison matches either.
fn code_at(body: &[u16], position: usize) -> i32 {
    char_code_at(body, position).map_or(-1, i32::from)
}

/// PORT: `body.slice(start, end)`. Slices end where the lexer stopped
/// reading, which is never inside a surrogate pair, except in the text of
/// some errors.
fn slice(body: &[u16], start: usize, end: usize) -> String {
    let end = end.min(body.len());
    String::from_utf16_lossy(&body[start.min(end)..end])
}

/// PORT: `String.fromCodePoint(...codes)` for codes which are Unicode scalar
/// values or a surrogate pair.
fn from_code_points(codes: &[i32]) -> String {
    let code_units: Vec<u16> = codes
        .iter()
        .flat_map(|&code| match char::from_u32(code as u32) {
            Some(char) => char.encode_utf16(&mut [0; 2]).to_vec(),
            None => vec![code as u16],
        })
        .collect();
    String::from_utf16(&code_units).expect("Should be Unicode scalar values or a surrogate pair")
}

/// Prints the code point (or end of file reference) at a given location in a
/// source for use in error messages.
///
/// Printable ASCII is printed quoted, while other points are printed in Unicode
/// code point form (ie. U+1234).
fn print_code_point_at(lexer: &Lexer, location: usize) -> String {
    // PORT: `body.codePointAt(location)`.
    let code = match char_code_at(&lexer.body, location) {
        None => return TokenKind::Eof.as_str().to_string(),
        Some(code) if is_supplementary_code_point(&lexer.body, location) => {
            let trailing = u32::from(lexer.body[location + 1]);
            0x10000 + ((u32::from(code) - 0xd800) << 10) + (trailing - 0xdc00)
        }
        Some(code) => u32::from(code),
    };
    if (0x0020..=0x007e).contains(&code) {
        // Printable ASCII
        let char = char::from_u32(code).expect("Should be ASCII");
        return if char == '"' {
            "'\"'".to_string()
        } else {
            format!("\"{char}\"")
        };
    }

    // Unicode code point
    format!("U+{code:04X}")
}

/// PORT: The end of the source character at `position`, where a syntax
/// error's location ends. At a line terminator or the end of the body, the
/// location is empty.
fn code_point_end(lexer: &Lexer, position: usize) -> usize {
    match char_code_at(&lexer.body, position) {
        None | Some(0x000a | 0x000d) => position,
        Some(_) if is_supplementary_code_point(&lexer.body, position) => position + 2,
        Some(_) => position + 1,
    }
}

/// Create a token with line and column location information.
fn create_token(
    lexer: &Lexer,
    kind: TokenKind,
    start: usize,
    end: usize,
    value: Option<String>,
) -> Token {
    let line = lexer.line;
    let col = 1 + start - lexer.line_start;
    Token::new(kind, start, end, line, col, value)
}

/// Gets the next token from the source starting at the given position.
///
/// This skips over whitespace until it finds the next lexable token, then lexes
/// punctuators immediately or calls the appropriate helper function for more
/// complicated tokens.
fn read_next_token(lexer: &mut Lexer, start: usize) -> Result<Token, GraphQLError> {
    let body_length = lexer.body.len();
    let mut position = start;

    while position < body_length {
        let code = lexer.body[position];

        // SourceCharacter
        let punctuator = match code {
            // Ignored ::
            //   - UnicodeBOM
            //   - WhiteSpace
            //   - LineTerminator
            //   - Comment
            //   - Comma
            //
            // UnicodeBOM :: "Byte Order Mark (U+FEFF)"
            //
            // WhiteSpace ::
            //   - "Horizontal Tab (U+0009)"
            //   - "Space (U+0020)"
            //
            // Comma :: ,
            0xfeff // <BOM>
            | 0x0009 // \t
            | 0x0020 // <space>
            | 0x002c => {
                // ,
                position += 1;
                continue;
            }
            // LineTerminator ::
            //   - "New Line (U+000A)"
            //   - "Carriage Return (U+000D)" [lookahead != "New Line (U+000A)"]
            //   - "Carriage Return (U+000D)" "New Line (U+000A)"
            0x000a => {
                // \n
                position += 1;
                lexer.line += 1;
                lexer.line_start = position;
                position = skip_docblock_decoration(lexer, position);
                continue;
            }
            0x000d => {
                // \r
                if char_code_at(&lexer.body, position + 1) == Some(0x000a) {
                    position += 2;
                } else {
                    position += 1;
                }
                lexer.line += 1;
                lexer.line_start = position;
                position = skip_docblock_decoration(lexer, position);
                continue;
            }
            // Comment
            0x0023 => {
                // #
                return Ok(read_comment(lexer, position));
            }
            // Token ::
            //   - Punctuator
            //   - Name
            //   - IntValue
            //   - FloatValue
            //   - StringValue
            //
            // Punctuator :: one of ! $ & ( ) ... : = @ [ ] { | }
            0x0021 => Some(TokenKind::Bang),     // !
            0x0024 => Some(TokenKind::Dollar),   // $
            0x0026 => Some(TokenKind::Amp),      // &
            0x0028 => Some(TokenKind::ParenL),   // (
            0x0029 => Some(TokenKind::ParenR),   // )
            0x002e => {
                // .
                if char_code_at(&lexer.body, position + 1) == Some(0x002e)
                    && char_code_at(&lexer.body, position + 2) == Some(0x002e)
                {
                    return Ok(create_token(
                        lexer,
                        TokenKind::Spread,
                        position,
                        position + 3,
                        None,
                    ));
                }
                None
            }
            0x003a => Some(TokenKind::Colon),    // :
            0x003d => Some(TokenKind::Equals),   // =
            0x0040 => Some(TokenKind::At),       // @
            0x005b => Some(TokenKind::BracketL), // [
            0x005d => Some(TokenKind::BracketR), // ]
            0x007b => Some(TokenKind::BraceL),   // {
            0x007c => Some(TokenKind::Pipe),     // |
            0x007d => Some(TokenKind::BraceR),   // }
            // StringValue
            0x0022 => {
                // "
                if char_code_at(&lexer.body, position + 1) == Some(0x0022)
                    && char_code_at(&lexer.body, position + 2) == Some(0x0022)
                {
                    return read_block_string(lexer, position);
                }
                return read_string(lexer, position);
            }
            _ => None,
        };
        // PORT: Each punctuator case returns a token of that kind.
        if let Some(kind) = punctuator {
            return Ok(create_token(lexer, kind, position, position + 1, None));
        }

        // IntValue | FloatValue (Digit | -)
        if is_digit(Some(code)) || code == 0x002d {
            return read_number(lexer, position, code);
        }

        // Name
        if is_name_start(Some(code)) {
            return Ok(read_name(lexer, position));
        }

        return Err(syntax_error(
            &lexer.source,
            position,
            code_point_end(lexer, position),
            &if code == 0x0027 {
                "Unexpected single quote character ('), did you mean to use a double quote (\")?"
                    .to_string()
            } else if is_unicode_scalar_value(i32::from(code))
                || is_supplementary_code_point(&lexer.body, position)
            {
                format!(
                    "Unexpected character: {}.",
                    print_code_point_at(lexer, position)
                )
            } else {
                format!(
                    "Invalid character: {}.",
                    print_code_point_at(lexer, position)
                )
            },
        ));
    }

    Ok(create_token(
        lexer,
        TokenKind::Eof,
        body_length,
        body_length,
        None,
    ))
}

/// PORT: In a docblock, a line's leading `*` and the whitespace before it
/// are ignored, like JSDoc does. Returns the position after them, given the
/// position at which the line begins.
fn skip_docblock_decoration(lexer: &Lexer, line_start: usize) -> usize {
    if !lexer.source.docblock {
        return line_start;
    }
    let mut position = line_start;
    while matches!(char_code_at(&lexer.body, position), Some(0x0009 | 0x0020)) {
        position += 1;
    }
    if char_code_at(&lexer.body, position) == Some(0x002a) {
        position + 1
    } else {
        line_start
    }
}

/// Reads a comment token from the source file.
///
/// ```text
/// Comment :: # CommentChar* [lookahead != CommentChar]
///
/// CommentChar :: SourceCharacter but not LineTerminator
/// ```
fn read_comment(lexer: &Lexer, start: usize) -> Token {
    let body = &lexer.body;
    let body_length = body.len();
    let mut position = start + 1;

    while position < body_length {
        let code = body[position];

        // LineTerminator (\n | \r)
        if code == 0x000a || code == 0x000d {
            break;
        }

        // SourceCharacter
        if is_unicode_scalar_value(i32::from(code)) {
            position += 1;
        } else if is_supplementary_code_point(body, position) {
            position += 2;
        } else {
            break;
        }
    }

    create_token(
        lexer,
        TokenKind::Comment,
        start,
        position,
        Some(slice(body, start + 1, position)),
    )
}

/// Reads a number token from the source file, either a FloatValue or an IntValue
/// depending on whether a FractionalPart or ExponentPart is encountered.
///
/// ```text
/// IntValue :: IntegerPart [lookahead != {Digit, `.`, NameStart}]
///
/// IntegerPart ::
///   - NegativeSign? 0
///   - NegativeSign? NonZeroDigit Digit*
///
/// NegativeSign :: -
///
/// NonZeroDigit :: Digit but not `0`
///
/// FloatValue ::
///   - IntegerPart FractionalPart ExponentPart [lookahead != {Digit, `.`, NameStart}]
///   - IntegerPart FractionalPart [lookahead != {Digit, `.`, NameStart}]
///   - IntegerPart ExponentPart [lookahead != {Digit, `.`, NameStart}]
///
/// FractionalPart :: . Digit+
///
/// ExponentPart :: ExponentIndicator Sign? Digit+
///
/// ExponentIndicator :: one of `e` `E`
///
/// Sign :: one of + -
/// ```
fn read_number(lexer: &Lexer, start: usize, first_code: u16) -> Result<Token, GraphQLError> {
    let body = &lexer.body;
    let mut position = start;
    let mut code = Some(first_code);
    let mut is_float = false;

    // NegativeSign (-)
    if code == Some(0x002d) {
        position += 1;
        code = char_code_at(body, position);
    }

    // Zero (0)
    if code == Some(0x0030) {
        position += 1;
        code = char_code_at(body, position);
        if is_digit(code) {
            return Err(syntax_error(
                &lexer.source,
                position,
                code_point_end(lexer, position),
                &format!(
                    "Invalid number, unexpected digit after 0: {}.",
                    print_code_point_at(lexer, position)
                ),
            ));
        }
    } else {
        position = read_digits(lexer, position, code)?;
        code = char_code_at(body, position);
    }

    // Full stop (.)
    if code == Some(0x002e) {
        is_float = true;

        position += 1;
        code = char_code_at(body, position);
        position = read_digits(lexer, position, code)?;
        code = char_code_at(body, position);
    }

    // E e
    if code == Some(0x0045) || code == Some(0x0065) {
        is_float = true;

        position += 1;
        code = char_code_at(body, position);
        // + -
        if code == Some(0x002b) || code == Some(0x002d) {
            position += 1;
            code = char_code_at(body, position);
        }
        position = read_digits(lexer, position, code)?;
        code = char_code_at(body, position);
    }

    // Numbers cannot be followed by . or NameStart
    if code == Some(0x002e) || is_name_start(code) {
        return Err(syntax_error(
            &lexer.source,
            position,
            code_point_end(lexer, position),
            &format!(
                "Invalid number, expected digit but got: {}.",
                print_code_point_at(lexer, position)
            ),
        ));
    }

    Ok(create_token(
        lexer,
        if is_float {
            TokenKind::Float
        } else {
            TokenKind::Int
        },
        start,
        position,
        Some(slice(body, start, position)),
    ))
}

/// Returns the new position in the source after reading one or more digits.
fn read_digits(
    lexer: &Lexer,
    start: usize,
    first_code: Option<u16>,
) -> Result<usize, GraphQLError> {
    if !is_digit(first_code) {
        return Err(syntax_error(
            &lexer.source,
            start,
            code_point_end(lexer, start),
            &format!(
                "Invalid number, expected digit but got: {}.",
                print_code_point_at(lexer, start)
            ),
        ));
    }

    let body = &lexer.body;
    let mut position = start + 1; // +1 to skip first firstCode

    while is_digit(char_code_at(body, position)) {
        position += 1;
    }

    Ok(position)
}

/// Reads a single-quote string token from the source file.
///
/// ```text
/// StringValue ::
///   - `""` [lookahead != `"`]
///   - `"` StringCharacter+ `"`
///
/// StringCharacter ::
///   - SourceCharacter but not `"` or `\` or LineTerminator
///   - `\u` EscapedUnicode
///   - `\` EscapedCharacter
///
/// EscapedUnicode ::
///   - `{` HexDigit+ `}`
///   - HexDigit HexDigit HexDigit HexDigit
///
/// EscapedCharacter :: one of `"` `\` `/` `b` `f` `n` `r` `t`
/// ```
fn read_string(lexer: &Lexer, start: usize) -> Result<Token, GraphQLError> {
    let body = &lexer.body;
    let body_length = body.len();
    let mut position = start + 1;
    let mut chunk_start = position;
    let mut value = String::new();

    while position < body_length {
        let code = body[position];

        // Closing Quote (")
        if code == 0x0022 {
            value += &slice(body, chunk_start, position);
            return Ok(create_token(
                lexer,
                TokenKind::String,
                start,
                position + 1,
                Some(value),
            ));
        }

        // Escape Sequence (\)
        if code == 0x005c {
            value += &slice(body, chunk_start, position);
            let escape = if char_code_at(body, position + 1) == Some(0x0075) {
                // u
                if char_code_at(body, position + 2) == Some(0x007b) {
                    // {
                    read_escaped_unicode_variable_width(lexer, position)?
                } else {
                    read_escaped_unicode_fixed_width(lexer, position)?
                }
            } else {
                read_escaped_character(lexer, position)?
            };
            value += &escape.value;
            position += escape.size;
            chunk_start = position;
            continue;
        }

        // LineTerminator (\n | \r)
        if code == 0x000a || code == 0x000d {
            break;
        }

        // SourceCharacter
        if is_unicode_scalar_value(i32::from(code)) {
            position += 1;
        } else if is_supplementary_code_point(body, position) {
            position += 2;
        } else {
            return Err(syntax_error(
                &lexer.source,
                position,
                code_point_end(lexer, position),
                &format!(
                    "Invalid character within String: {}.",
                    print_code_point_at(lexer, position)
                ),
            ));
        }
    }

    Err(syntax_error(
        &lexer.source,
        start,
        position,
        "Unterminated string.",
    ))
}

// The string value and lexed size of an escape sequence.
struct EscapeSequence {
    value: String,
    size: usize,
}

fn read_escaped_unicode_variable_width(
    lexer: &Lexer,
    position: usize,
) -> Result<EscapeSequence, GraphQLError> {
    let body = &lexer.body;
    let mut point: i32 = 0;
    let mut size = 3;
    // Cannot be larger than 12 chars (\u{00000000}).
    while size < 12 {
        let code = char_code_at(body, position + size);
        size += 1;
        // Closing Brace (})
        if code == Some(0x007d) {
            // Must be at least 5 chars (\u{0}) and encode a Unicode scalar value.
            if size < 5 || !is_unicode_scalar_value(point) {
                break;
            }
            return Ok(EscapeSequence {
                value: from_code_points(&[point]),
                size,
            });
        }
        // Append this hex digit to the code point.
        point = (point << 4) | read_hex_digit(code);
        if point < 0 {
            break;
        }
    }

    Err(syntax_error(
        &lexer.source,
        position,
        (position + size).min(body.len()),
        &format!(
            "Invalid Unicode escape sequence: \"{}\".",
            slice(body, position, position + size)
        ),
    ))
}

fn read_escaped_unicode_fixed_width(
    lexer: &Lexer,
    position: usize,
) -> Result<EscapeSequence, GraphQLError> {
    let body = &lexer.body;
    let code = read_16_bit_hex_code(body, position + 2);

    if is_unicode_scalar_value(code) {
        return Ok(EscapeSequence {
            value: from_code_points(&[code]),
            size: 6,
        });
    }

    // GraphQL allows JSON-style surrogate pair escape sequences, but only when
    // a valid pair is formed.
    if is_leading_surrogate(code) {
        // \u
        if char_code_at(body, position + 6) == Some(0x005c)
            && char_code_at(body, position + 7) == Some(0x0075)
        {
            let trailing_code = read_16_bit_hex_code(body, position + 8);
            if is_trailing_surrogate(trailing_code) {
                // JavaScript defines strings as a sequence of UTF-16 code units and
                // encodes Unicode code points above U+FFFF using a surrogate pair of
                // code units. Since this is a surrogate pair escape sequence, just
                // include both codes into the JavaScript string value. Had JavaScript
                // not been internally based on UTF-16, then this surrogate pair would
                // be decoded to retrieve the supplementary code point.
                return Ok(EscapeSequence {
                    value: from_code_points(&[code, trailing_code]),
                    size: 12,
                });
            }
        }
    }

    Err(syntax_error(
        &lexer.source,
        position,
        (position + 6).min(body.len()),
        &format!(
            "Invalid Unicode escape sequence: \"{}\".",
            slice(body, position, position + 6)
        ),
    ))
}

/// Reads four hexadecimal characters and returns the positive integer that 16bit
/// hexadecimal string represents. For example, "000f" will return 15, and "dead"
/// will return 57005.
///
/// Returns a negative number if any char was not a valid hexadecimal digit.
fn read_16_bit_hex_code(body: &[u16], position: usize) -> i32 {
    // readHexDigit() returns -1 on error. ORing a negative value with any other
    // value always produces a negative value.
    (read_hex_digit(char_code_at(body, position)) << 12)
        | (read_hex_digit(char_code_at(body, position + 1)) << 8)
        | (read_hex_digit(char_code_at(body, position + 2)) << 4)
        | read_hex_digit(char_code_at(body, position + 3))
}

/// Reads a hexadecimal character and returns its positive integer value (0-15).
///
/// '0' becomes 0, '9' becomes 9
/// 'A' becomes 10, 'F' becomes 15
/// 'a' becomes 10, 'f' becomes 15
///
/// Returns -1 if the provided character code was not a valid hexadecimal digit.
///
/// HexDigit :: one of
///   - `0` `1` `2` `3` `4` `5` `6` `7` `8` `9`
///   - `A` `B` `C` `D` `E` `F`
///   - `a` `b` `c` `d` `e` `f`
fn read_hex_digit(code: Option<u16>) -> i32 {
    match code {
        Some(code @ 0x0030..=0x0039) => i32::from(code) - 0x0030, // 0-9
        Some(code @ 0x0041..=0x0046) => i32::from(code) - 0x0037, // A-F
        Some(code @ 0x0061..=0x0066) => i32::from(code) - 0x0057, // a-f
        _ => -1,
    }
}

/// | Escaped Character | Code Point | Character Name               |
/// | ----------------- | ---------- | ---------------------------- |
/// | `"`               | U+0022     | double quote                 |
/// | `\`               | U+005C     | reverse solidus (back slash) |
/// | `/`               | U+002F     | solidus (forward slash)      |
/// | `b`               | U+0008     | backspace                    |
/// | `f`               | U+000C     | form feed                    |
/// | `n`               | U+000A     | line feed (new line)         |
/// | `r`               | U+000D     | carriage return              |
/// | `t`               | U+0009     | horizontal tab               |
fn read_escaped_character(lexer: &Lexer, position: usize) -> Result<EscapeSequence, GraphQLError> {
    let body = &lexer.body;
    let code = char_code_at(body, position + 1);
    let value = match code {
        Some(0x0022) => Some('\u{0022}'), // "
        Some(0x005c) => Some('\u{005c}'), // \
        Some(0x002f) => Some('\u{002f}'), // /
        Some(0x0062) => Some('\u{0008}'), // b
        Some(0x0066) => Some('\u{000c}'), // f
        Some(0x006e) => Some('\u{000a}'), // n
        Some(0x0072) => Some('\u{000d}'), // r
        Some(0x0074) => Some('\u{0009}'), // t
        _ => None,
    };
    if let Some(value) = value {
        return Ok(EscapeSequence {
            value: value.to_string(),
            size: 2,
        });
    }
    Err(syntax_error(
        &lexer.source,
        position,
        (position + 2).min(lexer.body.len()),
        &format!(
            "Invalid character escape sequence: \"{}\".",
            slice(body, position, position + 2)
        ),
    ))
}

/// Reads a block string token from the source file.
///
/// ```text
/// StringValue ::
///   - `"""` BlockStringCharacter* `"""`
///
/// BlockStringCharacter ::
///   - SourceCharacter but not `"""` or `\"""`
///   - `\"""`
/// ```
fn read_block_string(lexer: &mut Lexer, start: usize) -> Result<Token, GraphQLError> {
    let body_length = lexer.body.len();
    let mut line_start = lexer.line_start;

    let mut position = start + 3;
    let mut chunk_start = position;
    let mut current_line = String::new();

    let mut block_lines = Vec::new();

    while position < body_length {
        let body = &lexer.body;
        let code = body[position];

        // Closing Triple-Quote (""")
        if code == 0x0022
            && char_code_at(body, position + 1) == Some(0x0022)
            && char_code_at(body, position + 2) == Some(0x0022)
        {
            current_line += &slice(body, chunk_start, position);
            block_lines.push(current_line);
            let line_count = block_lines.len();

            let token = create_token(
                lexer,
                TokenKind::BlockString,
                start,
                position + 3,
                // Return a string of the lines joined with U+000A.
                Some(dedent_block_string_lines(block_lines).join("\n")),
            );

            lexer.line += line_count - 1;
            lexer.line_start = line_start;
            return Ok(token);
        }

        // Escaped Triple-Quote (\""")
        if code == 0x005c
            && char_code_at(body, position + 1) == Some(0x0022)
            && char_code_at(body, position + 2) == Some(0x0022)
            && char_code_at(body, position + 3) == Some(0x0022)
        {
            current_line += &slice(body, chunk_start, position);
            chunk_start = position + 1; // skip only slash
            position += 4;
            continue;
        }

        // LineTerminator
        if code == 0x000a || code == 0x000d {
            current_line += &slice(body, chunk_start, position);
            block_lines.push(std::mem::take(&mut current_line));

            if code == 0x000d && char_code_at(body, position + 1) == Some(0x000a) {
                position += 2;
            } else {
                position += 1;
            }

            line_start = position;
            position = skip_docblock_decoration(lexer, position);
            chunk_start = position;
            continue;
        }

        // SourceCharacter
        if is_unicode_scalar_value(i32::from(code)) {
            position += 1;
        } else if is_supplementary_code_point(body, position) {
            position += 2;
        } else {
            return Err(syntax_error(
                &lexer.source,
                position,
                code_point_end(lexer, position),
                &format!(
                    "Invalid character within String: {}.",
                    print_code_point_at(lexer, position)
                ),
            ));
        }
    }

    Err(syntax_error(
        &lexer.source,
        start,
        position,
        "Unterminated string.",
    ))
}

/// Reads an alphanumeric + underscore name from the source.
///
/// ```text
/// Name ::
///   - NameStart NameContinue* [lookahead != NameContinue]
/// ```
fn read_name(lexer: &Lexer, start: usize) -> Token {
    let body = &lexer.body;
    let body_length = body.len();
    let mut position = start + 1;

    while position < body_length {
        let code = body[position];
        if is_name_continue(Some(code)) {
            position += 1;
        } else {
            break;
        }
    }

    create_token(
        lexer,
        TokenKind::Name,
        start,
        position,
        Some(slice(body, start, position)),
    )
}

#[cfg(test)]
mod tests {
    use super::Lexer;
    use crate::language::source::Source;
    use crate::language::token_kind::TokenKind;

    // Expectations are from graphql-js.

    #[test]
    fn lexes_tokens_with_positions_and_values() {
        let source = Source::new(
            "# c\nscalar S @d(a: \"x\\u{1F600}\", b: \"\"\"\n    one\n      two\n  \"\"\", c: -1.5e3)\n",
            0,
        );
        let mut lexer = Lexer::new(source);
        let mut tokens = Vec::new();
        loop {
            let token = lexer.advance().unwrap().clone();
            let done = token.kind == TokenKind::Eof;
            tokens.push((
                token.kind,
                token.start,
                token.end,
                token.line,
                token.column,
                token.value,
            ));
            if done {
                break;
            }
        }
        let name = |value: &str| Some(value.to_string());
        assert_eq!(
            tokens,
            [
                (TokenKind::Name, 4, 10, 2, 1, name("scalar")),
                (TokenKind::Name, 11, 12, 2, 8, name("S")),
                (TokenKind::At, 13, 14, 2, 10, None),
                (TokenKind::Name, 14, 15, 2, 11, name("d")),
                (TokenKind::ParenL, 15, 16, 2, 12, None),
                (TokenKind::Name, 16, 17, 2, 13, name("a")),
                (TokenKind::Colon, 17, 18, 2, 14, None),
                (TokenKind::String, 19, 31, 2, 16, name("x\u{1F600}")),
                (TokenKind::Name, 33, 34, 2, 30, name("b")),
                (TokenKind::Colon, 34, 35, 2, 31, None),
                (TokenKind::BlockString, 36, 63, 2, 33, name("one\n  two")),
                (TokenKind::Name, 65, 66, 5, 8, name("c")),
                (TokenKind::Colon, 66, 67, 5, 9, None),
                (TokenKind::Float, 68, 74, 5, 11, name("-1.5e3")),
                (TokenKind::ParenR, 74, 75, 5, 17, None),
                (TokenKind::Eof, 76, 76, 6, 1, None),
            ]
        );
    }

    #[test]
    fn lookahead_skips_comments_without_advancing() {
        let source = Source::new("a # c\n b", 0);
        let mut lexer = Lexer::new(source);
        assert_eq!(lexer.lookahead().unwrap().value.as_deref(), Some("a"));
        assert_eq!(lexer.token().kind, TokenKind::Sof);
        assert_eq!(lexer.advance().unwrap().value.as_deref(), Some("a"));
        assert_eq!(lexer.lookahead().unwrap().value.as_deref(), Some("b"));
    }
}
