//! Port of the JSDoc parser in TypeScript's `parser.ts` (`JSDocParser`).
//!
//! PORT: Every tag is parsed as TypeScript parses tags it doesn't know
//! (`parseUnknownTag`), including tags such as `@param`, `@returns` and
//! `@type` which TypeScript parses specially. Grats only reads the names,
//! comments and locations of its own tags (and of `@deprecated`, which
//! TypeScript parses the same way). Nodes are only modeled as far as Grats
//! reads them.
//!
//! This changes which tags exist in a few edge cases, none involving Grats'
//! tags: TypeScript parses the `{@link X}` of `@throws {@link X}` as a type
//! expression, which fails at `@`, so `@link` begins a new tag. Here it's a
//! link in the comment of `@throws`. Nested tags (`@property` under
//! `@typedef`) are top-level tags here.

use oxc_span::Span;

use super::scanner::{Scanner, Token, is_js_white_space, js_slice, js_trim_end, utf16_len};

#[derive(Debug, Clone)]
pub struct JSDoc {
    pub pos: u32,
    pub end: u32,
    pub comment: Option<JSDocComment>,
    pub tags: Vec<JSDocTag>,
}

#[derive(Debug, Clone)]
pub struct JSDocTag {
    pub pos: u32,
    pub end: u32,
    pub tag_name: Identifier,
    pub comment: Option<JSDocComment>,
    /// PORT: The span of the comment's text, from its first non-whitespace
    /// character to its last, which TypeScript doesn't record.
    pub comment_span: Option<Span>,
}

#[derive(Debug, Clone)]
pub struct Identifier {
    pub pos: u32,
    pub end: u32,
    pub text: String,
}

/// PORT: `string | NodeArray<JSDocComment>`.
#[derive(Debug, Clone)]
pub enum JSDocComment {
    Text(String),
    Parts(Vec<JSDocCommentPart>),
}

/// PORT: `JSDocText | JSDocLink | JSDocLinkCode | JSDocLinkPlain`. Only the
/// locations of links are read.
#[derive(Debug, Clone)]
pub enum JSDocCommentPart {
    Text(String),
    Link {
        pos: u32,
        end: u32,
        kind: JSDocLinkKind,
        /// The name, as `entityNameToString` prints it.
        name: Option<String>,
        text: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JSDocLinkKind {
    Link,
    LinkCode,
    LinkPlain,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum JSDocState {
    BeginningOfLine,
    SawAsterisk,
    SavingComments,
    SavingBackticks, // NOTE: Only used when parsing tag comments
}

pub fn is_jsdoc_like_text(text: &str, start: usize) -> bool {
    let bytes = text.as_bytes();
    bytes.get(start + 1) == Some(&b'*')
        && bytes.get(start + 2) == Some(&b'*')
        && bytes.get(start + 3) != Some(&b'/')
}

/// PORT: `parseJSDocComment` and `parseJSDocCommentWorker`, for the comment
/// from `start` to `end`.
pub fn parse_jsdoc_comment(text: &str, start: u32, end: u32) -> Option<JSDoc> {
    let (start, end) = (start as usize, end as usize);
    if !is_jsdoc_like_text(text, start) {
        return None;
    }
    let mut parser = JSDocParser {
        text,
        start,
        scanner: Scanner::new(text, start + 3, end - 2),
        tags: Vec::new(),
        comments: Vec::new(),
        parts: Vec::new(),
        link_end: None,
        comments_pos: None,
    };
    let (comment, tags) = parser.do_jsdoc_scan();
    Some(JSDoc {
        pos: start as u32,
        end: end as u32,
        comment,
        tags,
    })
}

struct JSDocParser<'t> {
    text: &'t str,
    start: usize,
    scanner: Scanner<'t>,
    tags: Vec<JSDocTag>,
    comments: Vec<String>,
    parts: Vec<JSDocCommentPart>,
    link_end: Option<usize>,
    comments_pos: Option<usize>,
}

impl JSDocParser<'_> {
    fn token(&self) -> Token {
        self.scanner.token()
    }

    fn next_token_jsdoc(&mut self) -> Token {
        self.scanner.scan_jsdoc_token()
    }

    fn next_jsdoc_comment_text_token(&mut self, in_backticks: bool) -> Token {
        self.scanner.scan_jsdoc_comment_text_token(in_backticks)
    }

    fn parse_optional_jsdoc(&mut self, t: Token) -> bool {
        if self.token() == t {
            self.next_token_jsdoc();
            return true;
        }
        false
    }

    fn do_jsdoc_scan(&mut self) -> (Option<JSDocComment>, Vec<JSDocTag>) {
        let mut state = JSDocState::SawAsterisk;
        let mut margin: Option<usize> = None;
        let line_start = self.text[..self.start].rfind('\n').map_or(0, |i| i + 1);
        let mut indent = utf16_len(&self.text[line_start..self.start]) + 4;
        fn push_comment(
            comments: &mut Vec<String>,
            margin: &mut Option<usize>,
            indent: &mut usize,
            text: &str,
        ) {
            // PORT: `if (!margin)`, which is also true if the margin is 0.
            if margin.is_none_or(|margin| margin == 0) {
                *margin = Some(*indent);
            }
            comments.push(text.to_string());
            *indent += utf16_len(text);
        }

        self.next_token_jsdoc();
        while self.parse_optional_jsdoc(Token::WhitespaceTrivia) {}
        if self.parse_optional_jsdoc(Token::NewLineTrivia) {
            state = JSDocState::BeginningOfLine;
            indent = 0;
        }
        loop {
            match self.token() {
                Token::AtToken => {
                    remove_trailing_whitespace(&mut self.comments);
                    if self.comments_pos.is_none_or(|pos| pos == 0) {
                        self.comments_pos = Some(self.scanner.get_token_full_start());
                    }
                    let tag = self.parse_tag(indent);
                    self.tags.push(tag);
                    state = JSDocState::BeginningOfLine;
                    margin = None;
                }
                Token::NewLineTrivia => {
                    self.comments
                        .push(self.scanner.get_token_text().to_string());
                    state = JSDocState::BeginningOfLine;
                    indent = 0;
                }
                Token::AsteriskToken => {
                    let asterisk = self.scanner.get_token_text();
                    if state == JSDocState::SawAsterisk {
                        // If we've already seen an asterisk, then we can no longer parse a tag on this line
                        state = JSDocState::SavingComments;
                        push_comment(&mut self.comments, &mut margin, &mut indent, asterisk);
                    } else {
                        // Ignore the first asterisk on a line
                        state = JSDocState::SawAsterisk;
                        indent += utf16_len(asterisk);
                    }
                }
                Token::WhitespaceTrivia => {
                    // only collect whitespace if we're already saving comments or have just crossed the comment indent margin
                    let whitespace = self.scanner.get_token_text();
                    let len = utf16_len(whitespace);
                    if let Some(margin) = margin
                        && indent + len > margin
                    {
                        self.comments.push(
                            js_slice(whitespace, margin as isize - indent as isize).to_string(),
                        );
                    }
                    indent += len;
                }
                Token::EndOfFileToken => break,
                Token::JSDocCommentTextToken => {
                    state = JSDocState::SavingComments;
                    let value = self.scanner.get_token_value();
                    push_comment(&mut self.comments, &mut margin, &mut indent, value);
                }
                token => {
                    let mut is_link = false;
                    if token == Token::OpenBraceToken {
                        state = JSDocState::SavingComments;
                        let link_start = self.scanner.get_token_end() - 1;
                        if let Some(link) = self.parse_jsdoc_link(link_start) {
                            if self.link_end.is_none() {
                                remove_leading_newlines(&mut self.comments);
                            }
                            self.parts
                                .push(JSDocCommentPart::Text(self.comments.concat()));
                            self.parts.push(link);
                            self.comments = Vec::new();
                            self.link_end = Some(self.scanner.get_token_end());
                            is_link = true;
                        }
                    }
                    // fallthrough if it's not a {@link sequence
                    if !is_link {
                        state = JSDocState::SavingComments;
                        let text = self.scanner.get_token_text();
                        push_comment(&mut self.comments, &mut margin, &mut indent, text);
                    }
                }
            }
            if state == JSDocState::SavingComments {
                self.next_jsdoc_comment_text_token(false);
            } else {
                self.next_token_jsdoc();
            }
        }
        let trimmed_comments = js_trim_end(&self.comments.concat()).to_string();
        let mut parts = std::mem::take(&mut self.parts);
        if !parts.is_empty() && !trimmed_comments.is_empty() {
            parts.push(JSDocCommentPart::Text(trimmed_comments.clone()));
        }
        let comment = if !parts.is_empty() {
            Some(JSDocComment::Parts(parts))
        } else if !trimmed_comments.is_empty() {
            Some(JSDocComment::Text(trimmed_comments))
        } else {
            None
        };
        (comment, std::mem::take(&mut self.tags))
    }

    fn is_next_nonwhitespace_token_end_of_file(&mut self) -> bool {
        // We must use infinite lookahead, as there could be any number of newlines :(
        loop {
            self.next_token_jsdoc();
            if self.token() == Token::EndOfFileToken {
                return true;
            }
            if !(self.token() == Token::WhitespaceTrivia || self.token() == Token::NewLineTrivia) {
                return false;
            }
        }
    }

    /// PORT: `lookAhead(isNextNonwhitespaceTokenEndOfFile)`.
    fn look_ahead_is_next_nonwhitespace_token_end_of_file(&mut self) -> bool {
        let saved = self.scanner;
        let result = self.is_next_nonwhitespace_token_end_of_file();
        self.scanner = saved;
        result
    }

    fn skip_whitespace(&mut self) {
        if (self.token() == Token::WhitespaceTrivia || self.token() == Token::NewLineTrivia)
            && self.look_ahead_is_next_nonwhitespace_token_end_of_file()
        {
            return; // Don't skip whitespace prior to EoF (or end of comment) - that shouldn't be included in any node's range
        }
        while self.token() == Token::WhitespaceTrivia || self.token() == Token::NewLineTrivia {
            self.next_token_jsdoc();
        }
    }

    fn skip_whitespace_or_asterisk(&mut self) -> String {
        if (self.token() == Token::WhitespaceTrivia || self.token() == Token::NewLineTrivia)
            && self.look_ahead_is_next_nonwhitespace_token_end_of_file()
        {
            return String::new(); // Don't skip whitespace prior to EoF (or end of comment) - that shouldn't be included in any node's range
        }

        let mut preceding_line_break = self.scanner.has_preceding_line_break();
        let mut seen_line_break = false;
        let mut indent_text = String::new();
        while (preceding_line_break && self.token() == Token::AsteriskToken)
            || self.token() == Token::WhitespaceTrivia
            || self.token() == Token::NewLineTrivia
        {
            indent_text.push_str(self.scanner.get_token_text());
            if self.token() == Token::NewLineTrivia {
                preceding_line_break = true;
                seen_line_break = true;
                indent_text = String::new();
            } else if self.token() == Token::AsteriskToken {
                preceding_line_break = false;
            }
            self.next_token_jsdoc();
        }
        if seen_line_break {
            indent_text
        } else {
            String::new()
        }
    }

    fn parse_tag(&mut self, margin: usize) -> JSDocTag {
        debug_assert!(self.token() == Token::AtToken);
        let start = self.scanner.get_token_start();
        self.next_token_jsdoc();

        let tag_name = self.parse_jsdoc_identifier_name();
        let indent_text = self.skip_whitespace_or_asterisk();

        // PORT: TypeScript parses some tags specially. See the module's
        // documentation.
        self.parse_unknown_tag(start, tag_name, margin, &indent_text)
    }

    fn parse_trailing_tag_comments(
        &mut self,
        pos: usize,
        end: usize,
        margin: usize,
        indent_text: &str,
    ) -> (Option<JSDocComment>, Option<Span>) {
        let mut margin = margin;
        // some tags, like typedef and callback, have already parsed their comments earlier
        if indent_text.is_empty() {
            margin += utf16_len(&self.text[pos..end]);
        }
        let initial_margin = js_slice(indent_text, margin as isize).to_string();
        self.parse_tag_comments(margin, &initial_margin)
    }

    /// PORT: `initialMargin` is always given by `parseTrailingTagComments`,
    /// the only caller which is ported. Also returns the span of the
    /// comment's text.
    fn parse_tag_comments(
        &mut self,
        indent: usize,
        initial_margin: &str,
    ) -> (Option<JSDocComment>, Option<Span>) {
        let mut indent = indent;
        let mut span: Option<Span> = None;
        let mut comments: Vec<String> = Vec::new();
        let mut parts: Vec<JSDocCommentPart> = Vec::new();
        let mut state;
        let mut margin: Option<usize> = None;
        fn push_comment(
            comments: &mut Vec<String>,
            margin: &mut Option<usize>,
            indent: &mut usize,
            text: &str,
        ) {
            // PORT: `if (!margin)`, which is also true if the margin is 0.
            if margin.is_none_or(|margin| margin == 0) {
                *margin = Some(*indent);
            }
            comments.push(text.to_string());
            *indent += utf16_len(text);
        }
        if !initial_margin.is_empty() {
            push_comment(&mut comments, &mut margin, &mut indent, initial_margin);
        }
        state = JSDocState::SawAsterisk;
        let mut tok = self.token();
        loop {
            // The comment's text is every token but whitespace and the
            // asterisks which begin lines.
            let is_text = !matches!(tok, Token::NewLineTrivia | Token::WhitespaceTrivia)
                && !(tok == Token::AsteriskToken && state == JSDocState::BeginningOfLine);
            let token_start = self.scanner.get_token_start();
            match tok {
                Token::NewLineTrivia => {
                    state = JSDocState::BeginningOfLine;
                    // don't use pushComment here because we want to keep the margin unchanged
                    comments.push(self.scanner.get_token_text().to_string());
                    indent = 0;
                }
                Token::AtToken => {
                    let end = self.scanner.get_token_end();
                    self.scanner.reset_token_state(end - 1);
                    break;
                }
                Token::EndOfFileToken => {
                    // Done
                    break;
                }
                Token::WhitespaceTrivia => {
                    debug_assert!(
                        state != JSDocState::SavingComments && state != JSDocState::SavingBackticks,
                        "whitespace shouldn't come from the scanner while saving comment text"
                    );
                    let whitespace = self.scanner.get_token_text();
                    let len = utf16_len(whitespace);
                    // if the whitespace crosses the margin, take only the whitespace that passes the margin
                    if let Some(margin) = margin
                        && indent + len > margin
                    {
                        comments.push(
                            js_slice(whitespace, margin as isize - indent as isize).to_string(),
                        );
                        state = JSDocState::SavingComments;
                    }
                    indent += len;
                }
                Token::OpenBraceToken => {
                    state = JSDocState::SavingComments;
                    let link_start = self.scanner.get_token_end() - 1;
                    if let Some(link) = self.parse_jsdoc_link(link_start) {
                        parts.push(JSDocCommentPart::Text(comments.concat()));
                        parts.push(link);
                        comments = Vec::new();
                    } else {
                        let text = self.scanner.get_token_text();
                        push_comment(&mut comments, &mut margin, &mut indent, text);
                    }
                }
                Token::BacktickToken => {
                    if state == JSDocState::SavingBackticks {
                        state = JSDocState::SavingComments;
                    } else {
                        state = JSDocState::SavingBackticks;
                    }
                    let text = self.scanner.get_token_text();
                    push_comment(&mut comments, &mut margin, &mut indent, text);
                }
                Token::JSDocCommentTextToken => {
                    if state != JSDocState::SavingBackticks {
                        state = JSDocState::SavingComments; // leading identifiers start recording as well
                    }
                    let value = self.scanner.get_token_value();
                    push_comment(&mut comments, &mut margin, &mut indent, value);
                }
                Token::AsteriskToken if state == JSDocState::BeginningOfLine => {
                    // leading asterisks start recording on the *next* (non-whitespace) token
                    state = JSDocState::SawAsterisk;
                    indent += 1;
                }
                // record the * as a comment
                _ => {
                    if state != JSDocState::SavingBackticks {
                        state = JSDocState::SavingComments; // leading identifiers start recording as well
                    }
                    let text = self.scanner.get_token_text();
                    push_comment(&mut comments, &mut margin, &mut indent, text);
                }
            }
            if is_text {
                span = extend_span(span, self.text, token_start, self.scanner.get_token_end());
            }
            if state == JSDocState::SavingComments || state == JSDocState::SavingBackticks {
                tok = self.next_jsdoc_comment_text_token(state == JSDocState::SavingBackticks);
            } else {
                tok = self.next_token_jsdoc();
            }
        }

        remove_leading_newlines(&mut comments);
        let trimmed_comments = js_trim_end(&comments.concat()).to_string();
        let comment = if !parts.is_empty() {
            if !trimmed_comments.is_empty() {
                parts.push(JSDocCommentPart::Text(trimmed_comments));
            }
            Some(JSDocComment::Parts(parts))
        } else if !trimmed_comments.is_empty() {
            Some(JSDocComment::Text(trimmed_comments))
        } else {
            None
        };
        (comment, span)
    }

    fn parse_jsdoc_link(&mut self, start: usize) -> Option<JSDocCommentPart> {
        // PORT: `tryParse(parseJSDocLinkPrefix)`.
        let saved = self.scanner;
        let Some(kind) = self.parse_jsdoc_link_prefix() else {
            self.scanner = saved;
            return None;
        };
        self.next_token_jsdoc(); // start at token after link, then skip any whitespace
        self.skip_whitespace();
        let name = self.parse_jsdoc_link_name();
        let mut text = String::new();
        while self.token() != Token::CloseBraceToken
            && self.token() != Token::NewLineTrivia
            && self.token() != Token::EndOfFileToken
        {
            text.push_str(self.scanner.get_token_text());
            self.next_token_jsdoc();
        }
        Some(JSDocCommentPart::Link {
            pos: start as u32,
            end: self.scanner.get_token_end() as u32,
            kind,
            name,
            text,
        })
    }

    /// PORT: Returns the name as `entityNameToString` prints it. After each
    /// identifier, TypeScript's parser scans with its regular scanner (see
    /// `Scanner::scan_link_name_token`).
    fn parse_jsdoc_link_name(&mut self) -> Option<String> {
        if self.token() != Token::Identifier {
            return None;
        }
        let mut name = self.parse_identifier_name();
        while self.token() == Token::DotToken {
            self.scanner.scan_link_name_token();
            name.push('.');
            if self.token() != Token::PrivateIdentifier {
                name.push_str(&self.parse_identifier_name());
            }
        }
        while self.token() == Token::PrivateIdentifier {
            self.scanner.re_scan_hash_token(); // rescan #id as # id
            self.next_token_jsdoc(); // then advance to the identifier
            name.push('#');
            name.push_str(&self.parse_identifier_name());
        }
        Some(name)
    }

    /// PORT: `parseIdentifierName`, which advances with TypeScript's regular
    /// scanner (see `Scanner::scan_link_name_token`). Returns the
    /// identifier's text, which is empty if it's missing.
    fn parse_identifier_name(&mut self) -> String {
        if self.token() != Token::Identifier {
            return String::new();
        }
        let text = self.scanner.get_token_value().to_string();
        self.scanner.scan_link_name_token();
        text
    }

    fn parse_jsdoc_link_prefix(&mut self) -> Option<JSDocLinkKind> {
        self.skip_whitespace_or_asterisk();
        if self.token() == Token::OpenBraceToken
            && self.next_token_jsdoc() == Token::AtToken
            && self.next_token_jsdoc() == Token::Identifier
        {
            match self.scanner.get_token_value() {
                "link" => return Some(JSDocLinkKind::Link),
                "linkcode" => return Some(JSDocLinkKind::LinkCode),
                "linkplain" => return Some(JSDocLinkKind::LinkPlain),
                _ => {}
            }
        }
        None
    }

    fn parse_unknown_tag(
        &mut self,
        start: usize,
        tag_name: Identifier,
        indent: usize,
        indent_text: &str,
    ) -> JSDocTag {
        let end = self.scanner.get_token_full_start();
        let (comment, comment_span) =
            self.parse_trailing_tag_comments(start, end, indent, indent_text);
        JSDocTag {
            pos: start as u32,
            end: self.scanner.get_token_full_start() as u32,
            tag_name,
            comment,
            comment_span,
        }
    }

    fn parse_jsdoc_identifier_name(&mut self) -> Identifier {
        if self.token() != Token::Identifier {
            // PORT: A missing identifier.
            let pos = self.scanner.get_token_full_start() as u32;
            return Identifier {
                pos,
                end: pos,
                text: String::new(),
            };
        }
        let identifier = Identifier {
            pos: self.scanner.get_token_start() as u32,
            end: self.scanner.get_token_end() as u32,
            text: self.scanner.get_token_value().to_string(),
        };
        self.next_token_jsdoc();
        identifier
    }
}

/// Extends `span` to the non-whitespace text from `start` to `end`.
fn extend_span(span: Option<Span>, text: &str, start: usize, end: usize) -> Option<Span> {
    let token = &text[start..end];
    let trimmed = token.trim_start_matches(is_js_white_space);
    let start = start + token.len() - trimmed.len();
    let end = start + js_trim_end(trimmed).len();
    if start == end {
        return span;
    }
    Some(Span::new(
        span.map_or(start as u32, |span| span.start),
        end as u32,
    ))
}

fn remove_leading_newlines(comments: &mut Vec<String>) {
    while comments
        .first()
        .is_some_and(|comment| comment == "\n" || comment == "\r")
    {
        comments.remove(0);
    }
}

fn remove_trailing_whitespace(comments: &mut Vec<String>) {
    while let Some(last) = comments.last_mut() {
        let trimmed = js_trim_end(last);
        if trimmed.is_empty() {
            comments.pop();
        } else if trimmed.len() < last.len() {
            *last = trimmed.to_string();
            break;
        } else {
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn comment_spans(text: &str) -> Vec<Option<&str>> {
        let js_doc = parse_jsdoc_comment(text, 0, text.len() as u32).unwrap();
        js_doc
            .tags
            .iter()
            .map(|tag| {
                tag.comment_span
                    .map(|span| &text[span.start as usize..span.end as usize])
            })
            .collect()
    }

    #[test]
    fn locates_tag_comments() {
        assert_eq!(
            comment_spans("/** @a  One \n * two  \n * @b\n * @c `x` *y* */"),
            vec![Some("One \n * two"), None, Some("`x` *y*")]
        );
    }
}
