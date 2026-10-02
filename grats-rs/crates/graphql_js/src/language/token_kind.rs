//! Port of graphql-js `language/tokenKind.ts`.

/// An exported enum describing the different kinds of tokens that the
/// lexer emits.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenKind {
    Sof,
    Eof,
    Bang,
    Dollar,
    Amp,
    ParenL,
    ParenR,
    Spread,
    Colon,
    Equals,
    At,
    BracketL,
    BracketR,
    BraceL,
    Pipe,
    BraceR,
    Name,
    Int,
    Float,
    String,
    BlockString,
    Comment,
}

impl TokenKind {
    /// PORT: The string value of the graphql-js enum member.
    pub fn as_str(self) -> &'static str {
        match self {
            TokenKind::Sof => "<SOF>",
            TokenKind::Eof => "<EOF>",
            TokenKind::Bang => "!",
            TokenKind::Dollar => "$",
            TokenKind::Amp => "&",
            TokenKind::ParenL => "(",
            TokenKind::ParenR => ")",
            TokenKind::Spread => "...",
            TokenKind::Colon => ":",
            TokenKind::Equals => "=",
            TokenKind::At => "@",
            TokenKind::BracketL => "[",
            TokenKind::BracketR => "]",
            TokenKind::BraceL => "{",
            TokenKind::Pipe => "|",
            TokenKind::BraceR => "}",
            TokenKind::Name => "Name",
            TokenKind::Int => "Int",
            TokenKind::Float => "Float",
            TokenKind::String => "String",
            TokenKind::BlockString => "BlockString",
            TokenKind::Comment => "Comment",
        }
    }
}
