//! A scanner for JSDoc comments, like the parts of TypeScript's scanner which
//! scan them.
//!
//! Unlike TypeScript's, offsets are UTF-8 byte offsets into the text, rather
//! than UTF-16 offsets. Where TypeScript measures text by its UTF-16 length,
//! so do we (see `utf16_len`).

use oxc_syntax::identifier::{is_identifier_part, is_identifier_start};

pub fn is_white_space_like(ch: char) -> bool {
    is_white_space_single_line(ch) || is_line_break(ch)
}

/// Does not include line breaks. For that, see `is_white_space_like`.
pub fn is_white_space_single_line(ch: char) -> bool {
    // Note: nextLine is in the Zs space, and should be considered to be a
    // whitespace. It is explicitly not a line-break as it isn't in the exact
    // set specified by EcmaScript.
    matches!(
        ch,
        ' ' | '\t' | '\u{000B}' | '\u{000C}' | '\u{00A0}' | '\u{0085}' | '\u{1680}' | '\u{2000}'
            ..='\u{200B}' | '\u{202F}' | '\u{205F}' | '\u{3000}' | '\u{FEFF}'
    )
}

pub fn is_line_break(ch: char) -> bool {
    // ES5 7.3:
    // The ECMAScript line terminator characters are listed in Table 3.
    //     Table 3: Line Terminator Characters
    //     Code Unit Value     Name                    Formal Name
    //     \u000A              Line Feed               <LF>
    //     \u000D              Carriage Return         <CR>
    //     \u2028              Line separator          <LS>
    //     \u2029              Paragraph separator     <PS>
    // Only the characters in Table 3 are treated as line terminators. Other new line or line
    // breaking characters are treated as white space but not as line terminators.
    matches!(ch, '\n' | '\r' | '\u{2028}' | '\u{2029}')
}

/// The length of `text` in UTF-16 code units, which is how TypeScript
/// measures strings.
pub fn utf16_len(text: &str) -> usize {
    text.chars().map(char::len_utf16).sum()
}

/// JavaScript's `String.prototype.slice(start)`, where `start` is in
/// UTF-16 code units and counts from the end if it's negative.
pub fn js_slice(text: &str, start: isize) -> &str {
    let len = utf16_len(text) as isize;
    let start = if start < 0 {
        (len + start).max(0)
    } else {
        start.min(len)
    } as usize;
    let mut units = 0;
    for (index, ch) in text.char_indices() {
        if units >= start {
            return &text[index..];
        }
        units += ch.len_utf16();
    }
    ""
}

/// JavaScript's `String.prototype.trimEnd`, whose whitespace differs
/// from Rust's.
pub fn js_trim_end(text: &str) -> &str {
    text.trim_end_matches(is_js_white_space)
}

/// JavaScript's `String.prototype.trim`.
pub fn js_trim(text: &str) -> &str {
    text.trim_matches(is_js_white_space)
}

/// The characters JavaScript's `\s` and `String.prototype.trim` match:
/// its `WhiteSpace` and `LineTerminator`.
pub fn is_js_white_space(ch: char) -> bool {
    matches!(
        ch,
        '\t' | '\n' | '\u{000B}' | '\u{000C}' | '\r' | ' ' | '\u{00A0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

fn char_at(text: &str, pos: usize) -> Option<char> {
    text.get(pos..).and_then(|rest| rest.chars().next())
}

fn char_before(text: &str, pos: usize) -> Option<char> {
    text.get(..pos)
        .and_then(|before| before.chars().next_back())
}

/// The kinds of comments. Their ranges come from oxc.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommentKind {
    SingleLineCommentTrivia,
    MultiLineCommentTrivia,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CommentRange {
    pub pos: u32,
    pub end: u32,
    pub kind: CommentKind,
}

/// The tokens the JSDoc scanner produces: those of TypeScript's `SyntaxKind`
/// which its JSDoc scanner produces. Keywords are identifiers.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(clippy::enum_variant_names)]
pub enum Token {
    Unknown,
    EndOfFileToken,
    WhitespaceTrivia,
    NewLineTrivia,
    AtToken,
    AsteriskToken,
    OpenBraceToken,
    CloseBraceToken,
    OpenBracketToken,
    CloseBracketToken,
    OpenParenToken,
    CloseParenToken,
    LessThanToken,
    GreaterThanToken,
    EqualsToken,
    CommaToken,
    DotToken,
    BacktickToken,
    HashToken,
    Identifier,
    PrivateIdentifier,
    JSDocCommentTextToken,
}

/// Like TypeScript's scanner, after `scanRange` has set its range to a JSDoc
/// comment. It's `Copy` so that it can be saved and restored to look ahead.
#[derive(Clone, Copy)]
pub struct Scanner<'t> {
    text: &'t str,
    /// Current position (end position of text of current token)
    pos: usize,
    /// end of text
    end: usize,
    /// Start position of whitespace before current token
    full_start_pos: usize,
    /// Start position of text of current token
    token_start: usize,
    token: Token,
    preceding_line_break: bool,
}

impl<'t> Scanner<'t> {
    pub fn new(text: &'t str, start: usize, end: usize) -> Self {
        Scanner {
            text,
            pos: start,
            end,
            full_start_pos: start,
            token_start: start,
            token: Token::Unknown,
            preceding_line_break: false,
        }
    }

    pub fn token(&self) -> Token {
        self.token
    }

    pub fn get_token_full_start(&self) -> usize {
        self.full_start_pos
    }

    pub fn get_token_start(&self) -> usize {
        self.token_start
    }

    pub fn get_token_end(&self) -> usize {
        self.pos
    }

    pub fn has_preceding_line_break(&self) -> bool {
        self.preceding_line_break
    }

    pub fn get_token_text(&self) -> &'t str {
        &self.text[self.token_start..self.pos]
    }

    fn char_at(&self, pos: usize) -> Option<char> {
        if pos < self.end {
            char_at(self.text, pos)
        } else {
            None
        }
    }

    fn skip_while(&mut self, predicate: impl Fn(char) -> bool) {
        while let Some(ch) = self.char_at(self.pos).filter(|&ch| predicate(ch)) {
            self.pos += ch.len_utf8();
        }
    }

    pub fn scan_jsdoc_comment_text_token(&mut self, in_backticks: bool) -> Token {
        self.full_start_pos = self.pos;
        self.token_start = self.pos;
        self.preceding_line_break = false;
        if self.pos >= self.end {
            self.token = Token::EndOfFileToken;
            return self.token;
        }
        while let Some(ch) = self.char_at(self.pos) {
            if is_line_break(ch) || ch == '`' {
                break;
            }
            if !in_backticks {
                // @ doesn't start a new tag inside ``, and elsewhere, only after whitespace and before non-whitespace
                if ch == '{'
                    || (ch == '@'
                        && char_before(self.text, self.pos).is_some_and(is_white_space_single_line)
                        && !self.char_at(self.pos + 1).is_some_and(is_white_space_like))
                {
                    break;
                }
            }
            self.pos += ch.len_utf8();
        }
        if self.pos == self.token_start {
            return self.scan_jsdoc_token();
        }
        self.token = Token::JSDocCommentTextToken;
        self.token
    }

    pub fn scan_jsdoc_token(&mut self) -> Token {
        self.full_start_pos = self.pos;
        self.token_start = self.pos;
        self.preceding_line_break = false;
        let Some(ch) = self.char_at(self.pos) else {
            self.token = Token::EndOfFileToken;
            return self.token;
        };
        self.pos += ch.len_utf8();
        self.token = match ch {
            '\t' | '\u{000B}' | '\u{000C}' | ' ' => {
                self.skip_while(is_white_space_single_line);
                Token::WhitespaceTrivia
            }
            '@' => Token::AtToken,
            '\r' | '\n' => {
                if ch == '\r' && self.char_at(self.pos) == Some('\n') {
                    self.pos += 1;
                }
                self.preceding_line_break = true;
                Token::NewLineTrivia
            }
            '*' => Token::AsteriskToken,
            '{' => Token::OpenBraceToken,
            '}' => Token::CloseBraceToken,
            '[' => Token::OpenBracketToken,
            ']' => Token::CloseBracketToken,
            '(' => Token::OpenParenToken,
            ')' => Token::CloseParenToken,
            '<' => Token::LessThanToken,
            '>' => Token::GreaterThanToken,
            '=' => Token::EqualsToken,
            ',' => Token::CommaToken,
            '.' => Token::DotToken,
            '`' => Token::BacktickToken,
            '#' => Token::HashToken,
            // Unlike TypeScript, Unicode escapes in identifiers aren't supported.
            _ if is_identifier_start(ch) => {
                self.skip_while(|ch| is_identifier_part(ch) || ch == '-');
                Token::Identifier
            }
            _ => Token::Unknown,
        };
        self.token
    }

    /// Scans the next token of the name of a `{@link}` tag.
    ///
    /// TypeScript scans these tokens with its regular `scan`. Here, only
    /// what can continue a link name is scanned: whitespace is skipped (but
    /// not comments), and identifiers, private identifiers, `.` and `}` are
    /// tokens. Anything else ends the name.
    pub fn scan_link_name_token(&mut self) -> Token {
        self.full_start_pos = self.pos;
        self.preceding_line_break = false;
        while let Some(ch) = self.char_at(self.pos) {
            if is_line_break(ch) {
                self.preceding_line_break = true;
            } else if !is_white_space_single_line(ch) {
                break;
            }
            self.pos += ch.len_utf8();
        }
        self.token_start = self.pos;
        let Some(ch) = self.char_at(self.pos) else {
            self.token = Token::EndOfFileToken;
            return self.token;
        };
        self.pos += ch.len_utf8();
        self.token = match ch {
            '#' if self.char_at(self.pos).is_some_and(is_identifier_start) => {
                self.skip_while(is_identifier_part);
                Token::PrivateIdentifier
            }
            _ if is_identifier_start(ch) => {
                self.skip_while(is_identifier_part);
                Token::Identifier
            }
            '}' => Token::CloseBraceToken,
            '.' => Token::DotToken,
            _ => Token::Unknown,
        };
        self.token
    }

    /// Like TypeScript's `reScanHashToken`, for a private identifier.
    pub fn re_scan_hash_token(&mut self) -> Token {
        self.pos = self.token_start + 1;
        self.token = Token::HashToken;
        self.token
    }

    pub fn reset_token_state(&mut self, position: usize) {
        self.pos = position;
        self.full_start_pos = position;
        self.token_start = position;
        self.token = Token::Unknown;
        self.preceding_line_break = false;
    }
}
