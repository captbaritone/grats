//! Port of graphql-js `language/parser.ts`.
//!
//! PORT: Only what Grats parses is ported: directive definitions (for its
//! own directives and `@gqlDirective`), constant directives (for
//! `@gqlAnnotate`) and what they contain. Grats never passes parser options,
//! so their defaults are assumed.

use super::ast::BooleanValueNode;
use super::ast::{
    ConstArgumentNode, ConstDirectiveNode, ConstListValueNode, ConstObjectFieldNode,
    ConstObjectValueNode, ConstValueNode, DirectiveDefinitionNode, EnumValueNode, FloatValueNode,
    InputValueDefinitionNode, IntValueNode, ListTypeNode, Location, NameNode, NamedTypeNode,
    NonNullTypeNode, NullValueNode, NullableTypeNode, StringValueNode, Token, TypeNode,
    UNTRACKED_ID,
};
use super::directive_location::is_directive_location;
use super::lexer::{Lexer, is_punctuator_token_kind};
use super::source::Source;
use super::token_kind::TokenKind;
use crate::error::graphql_error::GraphQLError;
use crate::error::syntax_error::syntax_error;

/// PORT: graphql-js throws a `GraphQLError` if a syntax error is
/// encountered.
pub type ParseResult<T> = Result<T, GraphQLError>;

/// PORT: Like graphql-js's `parseConstValue` and `parseType`, which parse a
/// source that's a single construct, for the construct `parse_fn` parses.
pub fn parse_only<'s, T>(
    source: Source<'s>,
    parse_fn: impl FnOnce(&mut Parser<'s>) -> ParseResult<T>,
) -> ParseResult<T> {
    let mut parser = Parser::new(source);
    parser.expect_token(TokenKind::Sof)?;
    let result = parse_fn(&mut parser)?;
    parser.expect_token(TokenKind::Eof)?;
    Ok(result)
}

/// This class is exported only to assist people in implementing their own parsers
/// without duplicating too much code and should be used only as last resort for cases
/// such as experimental syntax or if certain features could not be contributed upstream.
///
/// It is still part of the internal API and is versioned, so any changes to it are never
/// considered breaking changes. If you still need to support multiple versions of the
/// library, please use the `versionInfo` variable for version detection.
pub struct Parser<'s> {
    lexer: Lexer<'s>,
}

impl<'s> Parser<'s> {
    pub fn new(source: Source<'s>) -> Self {
        Parser {
            lexer: Lexer::new(source),
        }
    }

    /// Converts a name lex token into a name parse node.
    pub fn parse_name(&mut self) -> ParseResult<NameNode> {
        let token = self.expect_token(TokenKind::Name)?;
        Ok(NameNode {
            loc: self.node(&token),
            value: token_value(&token),
            ts_identifier: UNTRACKED_ID,
        })
    }

    /// Argument[Const] : Name : Value[?Const]
    ///
    /// PORT: `parseArgument(true)`.
    pub fn parse_const_argument(&mut self) -> ParseResult<ConstArgumentNode> {
        let start = self.lexer.token().clone();
        let name = self.parse_name()?;

        self.expect_token(TokenKind::Colon)?;
        let value = self.parse_const_value_literal()?;
        Ok(ConstArgumentNode {
            loc: self.node(&start),
            name,
            value,
        })
    }

    // Implements the parsing rules in the Values section.

    /// Value[Const] :
    ///   - [~Const] Variable
    ///   - IntValue
    ///   - FloatValue
    ///   - StringValue
    ///   - BooleanValue
    ///   - NullValue
    ///   - EnumValue
    ///   - ListValue[?Const]
    ///   - ObjectValue[?Const]
    ///
    /// BooleanValue : one of `true` `false`
    ///
    /// NullValue : `null`
    ///
    /// EnumValue : Name but not `true`, `false` or `null`
    ///
    /// PORT: `parseValueLiteral(true)`.
    pub fn parse_const_value_literal(&mut self) -> ParseResult<ConstValueNode> {
        let token = self.lexer.token().clone();
        match token.kind {
            TokenKind::BracketL => Ok(ConstValueNode::ListValue(self.parse_const_list()?)),
            TokenKind::BraceL => Ok(ConstValueNode::ObjectValue(self.parse_const_object()?)),
            TokenKind::Int => {
                self.advance_lexer()?;
                Ok(ConstValueNode::IntValue(IntValueNode {
                    loc: self.node(&token),
                    value: token_value(&token),
                }))
            }
            TokenKind::Float => {
                self.advance_lexer()?;
                Ok(ConstValueNode::FloatValue(FloatValueNode {
                    loc: self.node(&token),
                    value: token_value(&token),
                }))
            }
            TokenKind::String | TokenKind::BlockString => {
                Ok(ConstValueNode::StringValue(self.parse_string_literal()?))
            }
            TokenKind::Name => {
                self.advance_lexer()?;
                let loc = self.node(&token);
                Ok(match token.value.as_deref() {
                    Some("true") => {
                        ConstValueNode::BooleanValue(BooleanValueNode { loc, value: true })
                    }
                    Some("false") => {
                        ConstValueNode::BooleanValue(BooleanValueNode { loc, value: false })
                    }
                    Some("null") => ConstValueNode::NullValue(NullValueNode { loc }),
                    _ => ConstValueNode::EnumValue(EnumValueNode {
                        loc,
                        value: token_value(&token),
                    }),
                })
            }
            TokenKind::Dollar => {
                self.expect_token(TokenKind::Dollar)?;
                if self.lexer.token().kind == TokenKind::Name {
                    let var_name = token_value(self.lexer.token());
                    Err(syntax_error(
                        &self.lexer.source,
                        token.start,
                        &format!("Unexpected variable \"${var_name}\" in constant value."),
                    ))
                } else {
                    Err(self.unexpected(Some(&token)))
                }
            }
            _ => Err(self.unexpected(None)),
        }
    }

    pub fn parse_string_literal(&mut self) -> ParseResult<StringValueNode> {
        let token = self.lexer.token().clone();
        self.advance_lexer()?;
        Ok(StringValueNode {
            loc: self.node(&token),
            value: token_value(&token),
            block: token.kind == TokenKind::BlockString,
        })
    }

    /// ListValue[Const] :
    ///   - [ ]
    ///   - [ Value[?Const]+ ]
    ///
    /// PORT: `parseList(true)`.
    pub fn parse_const_list(&mut self) -> ParseResult<ConstListValueNode> {
        let start = self.lexer.token().clone();
        let values = self.any(
            TokenKind::BracketL,
            Self::parse_const_value_literal,
            TokenKind::BracketR,
        )?;
        Ok(ConstListValueNode {
            loc: self.node(&start),
            values,
        })
    }

    /// ```text
    /// ObjectValue[Const] :
    ///   - { }
    ///   - { ObjectField[?Const]+ }
    /// ```
    ///
    /// PORT: `parseObject(true)`.
    pub fn parse_const_object(&mut self) -> ParseResult<ConstObjectValueNode> {
        let start = self.lexer.token().clone();
        let fields = self.any(
            TokenKind::BraceL,
            Self::parse_const_object_field,
            TokenKind::BraceR,
        )?;
        Ok(ConstObjectValueNode {
            loc: self.node(&start),
            fields,
        })
    }

    /// ObjectField[Const] : Name : Value[?Const]
    ///
    /// PORT: `parseObjectField(true)`.
    pub fn parse_const_object_field(&mut self) -> ParseResult<ConstObjectFieldNode> {
        let start = self.lexer.token().clone();
        let name = self.parse_name()?;
        self.expect_token(TokenKind::Colon)?;

        let value = self.parse_const_value_literal()?;
        Ok(ConstObjectFieldNode {
            loc: self.node(&start),
            name,
            value,
        })
    }

    // Implements the parsing rules in the Directives section.

    /// Directives[Const] : Directive[?Const]+
    ///
    /// PORT: `parseDirectives(true)`.
    pub fn parse_const_directives(&mut self) -> ParseResult<Vec<ConstDirectiveNode>> {
        let mut directives = Vec::new();
        while self.peek(TokenKind::At) {
            directives.push(self.parse_const_directive()?);
        }
        Ok(directives)
    }

    /// ```text
    /// Directive[Const] : @ Name Arguments[?Const]?
    /// ```
    ///
    /// PORT: `parseDirective(true)`.
    pub fn parse_const_directive(&mut self) -> ParseResult<ConstDirectiveNode> {
        let start = self.lexer.token().clone();
        self.expect_token(TokenKind::At)?;
        self.parse_const_directive_after(start)
    }

    /// PORT: A constant directive without its `@`, for docblock tags which
    /// stand in for it.
    pub fn parse_const_directive_without_at(&mut self) -> ParseResult<ConstDirectiveNode> {
        let start = self.lexer.token().clone();
        self.parse_const_directive_after(start)
    }

    /// PORT: The rest of a constant directive, which begins at `start`.
    fn parse_const_directive_after(&mut self, start: Token) -> ParseResult<ConstDirectiveNode> {
        let name = self.parse_name()?;
        // PORT: `parseArguments(true)`.
        let arguments = self.optional_many(
            TokenKind::ParenL,
            Self::parse_const_argument,
            TokenKind::ParenR,
        )?;
        Ok(ConstDirectiveNode {
            loc: self.node(&start),
            name,
            arguments: Some(arguments),
        })
    }

    // Implements the parsing rules in the Types section.

    /// Type :
    ///   - NamedType
    ///   - ListType
    ///   - NonNullType
    pub fn parse_type_reference(&mut self) -> ParseResult<TypeNode> {
        let start = self.lexer.token().clone();
        let r#type = if self.expect_optional_token(TokenKind::BracketL)? {
            let inner_type = self.parse_type_reference()?;
            self.expect_token(TokenKind::BracketR)?;
            NullableTypeNode::ListType(ListTypeNode {
                loc: self.node(&start),
                r#type: Box::new(inner_type),
                is_async_iterable: false,
            })
        } else {
            NullableTypeNode::NamedType(self.parse_named_type()?)
        };

        if self.expect_optional_token(TokenKind::Bang)? {
            return Ok(TypeNode::NonNullType(NonNullTypeNode {
                loc: self.node(&start),
                r#type: Box::new(r#type),
            }));
        }

        Ok(r#type.into())
    }

    /// NamedType : Name
    pub fn parse_named_type(&mut self) -> ParseResult<NamedTypeNode> {
        let start = self.lexer.token().clone();
        let name = self.parse_name()?;
        Ok(NamedTypeNode {
            loc: self.node(&start),
            name,
        })
    }

    // Implements the parsing rules in the Type Definition section.

    pub fn peek_description(&self) -> bool {
        self.peek(TokenKind::String) || self.peek(TokenKind::BlockString)
    }

    /// Description : StringValue
    pub fn parse_description(&mut self) -> ParseResult<Option<StringValueNode>> {
        if self.peek_description() {
            return self.parse_string_literal().map(Some);
        }
        Ok(None)
    }

    /// ArgumentsDefinition : ( InputValueDefinition+ )
    pub fn parse_argument_defs(&mut self) -> ParseResult<Vec<InputValueDefinitionNode>> {
        self.optional_many(
            TokenKind::ParenL,
            Self::parse_input_value_def,
            TokenKind::ParenR,
        )
    }

    /// InputValueDefinition :
    ///   - Description? Name : Type DefaultValue? Directives[Const]?
    pub fn parse_input_value_def(&mut self) -> ParseResult<InputValueDefinitionNode> {
        let start = self.lexer.token().clone();
        let description = self.parse_description()?;
        let name = self.parse_name()?;
        self.expect_token(TokenKind::Colon)?;
        let r#type = self.parse_type_reference()?;
        let mut default_value = None;
        if self.expect_optional_token(TokenKind::Equals)? {
            default_value = Some(self.parse_const_value_literal()?);
        }
        let directives = self.parse_const_directives()?;
        Ok(InputValueDefinitionNode {
            loc: self.node(&start),
            description,
            name,
            r#type,
            default_value,
            directives: Some(directives),
        })
    }

    /// ```text
    /// DirectiveDefinition :
    ///   - Description? directive @ Name ArgumentsDefinition? `repeatable`? on DirectiveLocations
    /// ```
    pub fn parse_directive_definition(&mut self) -> ParseResult<DirectiveDefinitionNode> {
        let start = self.lexer.token().clone();
        let description = self.parse_description()?;
        self.expect_keyword("directive")?;
        self.expect_token(TokenKind::At)?;
        let name = self.parse_name()?;
        let args = self.parse_argument_defs()?;
        let repeatable = self.expect_optional_keyword("repeatable")?;
        self.expect_keyword("on")?;
        let locations = self.parse_directive_locations()?;
        Ok(DirectiveDefinitionNode {
            loc: self.node(&start),
            description,
            name,
            arguments: Some(args),
            repeatable,
            locations,
        })
    }

    /// DirectiveLocations :
    ///   - `|`? DirectiveLocation
    ///   - DirectiveLocations | DirectiveLocation
    pub fn parse_directive_locations(&mut self) -> ParseResult<Vec<NameNode>> {
        self.delimited_many(TokenKind::Pipe, Self::parse_directive_location)
    }

    /// DirectiveLocation :
    ///   - ExecutableDirectiveLocation
    ///   - TypeSystemDirectiveLocation
    ///
    /// ExecutableDirectiveLocation : one of
    ///   `QUERY`
    ///   `MUTATION`
    ///   `SUBSCRIPTION`
    ///   `FIELD`
    ///   `FRAGMENT_DEFINITION`
    ///   `FRAGMENT_SPREAD`
    ///   `INLINE_FRAGMENT`
    ///
    /// TypeSystemDirectiveLocation : one of
    ///   `SCHEMA`
    ///   `SCALAR`
    ///   `OBJECT`
    ///   `FIELD_DEFINITION`
    ///   `ARGUMENT_DEFINITION`
    ///   `INTERFACE`
    ///   `UNION`
    ///   `ENUM`
    ///   `ENUM_VALUE`
    ///   `INPUT_OBJECT`
    ///   `INPUT_FIELD_DEFINITION`
    pub fn parse_directive_location(&mut self) -> ParseResult<NameNode> {
        let start = self.lexer.token().clone();
        let name = self.parse_name()?;
        if is_directive_location(&name.value) {
            return Ok(name);
        }
        Err(self.unexpected(Some(&start)))
    }

    // Core parsing utility functions

    /// Returns a node that, if configured to do so, sets a "loc" field as a
    /// location object, used to identify the place in the source that created a
    /// given parsed object.
    ///
    /// PORT: Returns the location to set on the node.
    fn node(&self, start_token: &Token) -> Option<Location> {
        Some(Location {
            source: self.lexer.source.id,
            start: self.lexer.source.offset + start_token.start as u32,
            end: self.lexer.source.offset + self.lexer.last_token().end as u32,
        })
    }

    /// Determines if the next token is of a given kind
    pub fn peek(&self, kind: TokenKind) -> bool {
        self.lexer.token().kind == kind
    }

    /// If the next token is of the given kind, return that token after advancing the lexer.
    /// Otherwise, do not change the parser state and throw an error.
    pub fn expect_token(&mut self, kind: TokenKind) -> ParseResult<Token> {
        let token = self.lexer.token().clone();
        if token.kind == kind {
            self.advance_lexer()?;
            return Ok(token);
        }

        Err(syntax_error(
            &self.lexer.source,
            token.start,
            &format!(
                "Expected {}, found {}.",
                get_token_kind_desc(kind),
                get_token_desc(&token)
            ),
        ))
    }

    /// If the next token is of the given kind, return "true" after advancing the lexer.
    /// Otherwise, do not change the parser state and return "false".
    pub fn expect_optional_token(&mut self, kind: TokenKind) -> ParseResult<bool> {
        if self.lexer.token().kind == kind {
            self.advance_lexer()?;
            return Ok(true);
        }
        Ok(false)
    }

    /// If the next token is a given keyword, advance the lexer.
    /// Otherwise, do not change the parser state and throw an error.
    pub fn expect_keyword(&mut self, value: &str) -> ParseResult<()> {
        let token = self.lexer.token();
        if token.kind == TokenKind::Name && token.value.as_deref() == Some(value) {
            self.advance_lexer()?;
            Ok(())
        } else {
            Err(syntax_error(
                &self.lexer.source,
                token.start,
                &format!("Expected \"{value}\", found {}.", get_token_desc(token)),
            ))
        }
    }

    /// If the next token is a given keyword, return "true" after advancing the lexer.
    /// Otherwise, do not change the parser state and return "false".
    pub fn expect_optional_keyword(&mut self, value: &str) -> ParseResult<bool> {
        let token = self.lexer.token();
        if token.kind == TokenKind::Name && token.value.as_deref() == Some(value) {
            self.advance_lexer()?;
            return Ok(true);
        }
        Ok(false)
    }

    /// Helper function for creating an error when an unexpected lexed token is encountered.
    pub fn unexpected(&self, at_token: Option<&Token>) -> GraphQLError {
        let token = at_token.unwrap_or_else(|| self.lexer.token());
        syntax_error(
            &self.lexer.source,
            token.start,
            &format!("Unexpected {}.", get_token_desc(token)),
        )
    }

    /// Returns a possibly empty list of parse nodes, determined by the parseFn.
    /// This list begins with a lex token of openKind and ends with a lex token of closeKind.
    /// Advances the parser to the next lex token after the closing token.
    pub fn any<T>(
        &mut self,
        open_kind: TokenKind,
        parse_fn: fn(&mut Self) -> ParseResult<T>,
        close_kind: TokenKind,
    ) -> ParseResult<Vec<T>> {
        self.expect_token(open_kind)?;
        let mut nodes = Vec::new();
        while !self.expect_optional_token(close_kind)? {
            nodes.push(parse_fn(self)?);
        }
        Ok(nodes)
    }

    /// Returns a list of parse nodes, determined by the parseFn.
    /// It can be empty only if open token is missing otherwise it will always return non-empty list
    /// that begins with a lex token of openKind and ends with a lex token of closeKind.
    /// Advances the parser to the next lex token after the closing token.
    pub fn optional_many<T>(
        &mut self,
        open_kind: TokenKind,
        parse_fn: fn(&mut Self) -> ParseResult<T>,
        close_kind: TokenKind,
    ) -> ParseResult<Vec<T>> {
        if self.expect_optional_token(open_kind)? {
            let mut nodes = Vec::new();
            loop {
                nodes.push(parse_fn(self)?);
                if self.expect_optional_token(close_kind)? {
                    break;
                }
            }
            return Ok(nodes);
        }
        Ok(Vec::new())
    }

    /// Returns a non-empty list of parse nodes, determined by the parseFn.
    /// This list may begin with a lex token of delimiterKind followed by items separated by lex tokens of tokenKind.
    /// Advances the parser to the next lex token after last item in the list.
    pub fn delimited_many<T>(
        &mut self,
        delimiter_kind: TokenKind,
        parse_fn: fn(&mut Self) -> ParseResult<T>,
    ) -> ParseResult<Vec<T>> {
        self.expect_optional_token(delimiter_kind)?;

        let mut nodes = Vec::new();
        loop {
            nodes.push(parse_fn(self)?);
            if !self.expect_optional_token(delimiter_kind)? {
                break;
            }
        }
        Ok(nodes)
    }

    /// PORT: graphql-js also counts tokens, to enforce the `maxTokens` option,
    /// which Grats never passes.
    fn advance_lexer(&mut self) -> ParseResult<()> {
        self.lexer.advance()?;
        Ok(())
    }
}

/// PORT: `token.value`, which the parser only reads from tokens which have
/// one.
fn token_value(token: &Token) -> String {
    token
        .value
        .clone()
        .expect("Non-punctuation tokens should have a value")
}

/// A helper function to describe a token as a string for debugging.
fn get_token_desc(token: &Token) -> String {
    let desc = get_token_kind_desc(token.kind);
    match &token.value {
        Some(value) => format!("{desc} \"{value}\""),
        None => desc,
    }
}

/// A helper function to describe a token kind as a string for debugging.
fn get_token_kind_desc(kind: TokenKind) -> String {
    if is_punctuator_token_kind(kind) {
        format!("\"{}\"", kind.as_str())
    } else {
        kind.as_str().to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::{Parser, parse_only};
    use crate::language::ast::{
        ConstDirectiveNode, DefinitionNode, DirectiveDefinitionNode, DocumentNode, Location,
    };
    use crate::language::printer::print_directive;
    use crate::language::source::Source;
    use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction, visit};

    // Expectations are from graphql-js.

    fn parse_directive(body: &str) -> Result<ConstDirectiveNode, String> {
        parse_only(Source::new(body, 3), Parser::parse_const_directive)
            .map_err(|error| error.message)
    }

    fn parse_directive_definition(body: &str) -> Result<DirectiveDefinitionNode, String> {
        parse_only(Source::new(body, 3), Parser::parse_directive_definition)
            .map_err(|error| error.message)
    }

    fn parse_docblock_directive(body: &str) -> Result<ConstDirectiveNode, String> {
        parse_only(
            Source::docblock(body, 3, 100),
            Parser::parse_const_directive_without_at,
        )
        .map_err(|error| error.message)
    }

    fn locations(document: &DocumentNode) -> Vec<(u32, u32)> {
        let mut locations = Locations(Vec::new());
        visit(document, &mut locations);
        locations.0
    }

    struct Locations(Vec<(u32, u32)>);

    impl<'n> ASTVisitor<'n> for Locations {
        fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
            if let ASTNode::Document(_) = node {
                return VisitAction::Continue;
            }
            let Location { source, start, end } = node.loc().unwrap();
            assert_eq!(source, 3);
            self.0.push((start, end));
            VisitAction::Continue
        }
    }

    #[test]
    fn records_node_locations() {
        let definition = parse_directive_definition(
            "\"d\" directive @x(a: [Int!] = [1] @y(b: 2)) repeatable on FIELD | OBJECT",
        )
        .unwrap();
        let document = DocumentNode {
            loc: None,
            definitions: vec![DefinitionNode::DirectiveDefinition(definition)],
        };
        assert_eq!(
            locations(&document),
            [
                (0, 71),
                (0, 3),
                (15, 16),
                (17, 41),
                (17, 18),
                (20, 26),
                (21, 25),
                (21, 24),
                (21, 24),
                (29, 32),
                (30, 31),
                (33, 41),
                (34, 35),
                (36, 40),
                (36, 37),
                (39, 40),
                (57, 62),
                (65, 71),
            ]
        );
    }

    #[test]
    fn ignores_docblock_decoration() {
        let directive = parse_docblock_directive(
            " d(\n   * a: [1,\n\t*  2],\n *\n * b: \"\"\"\n *   x\n *     y\n *   \"\"\")\n * ",
        )
        .unwrap();
        assert_eq!(
            print_directive(&directive),
            "@d(a: [1, 2], b: \"\"\"\nx\n  y\n\"\"\")"
        );
        // Offsets are in the docblock, after `offset`.
        let directive = parse_docblock_directive(" d(\n * a: 1)").unwrap();
        assert_eq!(
            directive.loc.map(|loc| (loc.start, loc.end)),
            Some((101, 112))
        );
        let argument = &directive.arguments.as_ref().unwrap()[0];
        assert_eq!(
            argument.loc.map(|loc| (loc.start, loc.end)),
            Some((107, 111))
        );
    }

    #[test]
    fn reports_docblock_asterisks_which_do_not_begin_lines() {
        let cases = [
            (" * d", "Syntax Error: Unexpected character: \"*\"."),
            (
                " d(a:\n * * 1)",
                "Syntax Error: Unexpected character: \"*\".",
            ),
            (" d(a: 1 *)", "Syntax Error: Unexpected character: \"*\"."),
        ];
        for (body, message) in cases {
            assert_eq!(
                parse_docblock_directive(body).unwrap_err(),
                message,
                "{body:?}"
            );
        }
        // Outside of docblocks, they're never ignored.
        assert_eq!(
            parse_directive("@d(a:\n * 1)").unwrap_err(),
            "Syntax Error: Unexpected character: \"*\"."
        );
    }

    #[test]
    fn parses_optional_lists_as_empty() {
        let definition = parse_directive_definition("directive @d on FIELD").unwrap();
        assert!(definition.description.is_none());
        assert_eq!(definition.arguments.as_ref().map(Vec::len), Some(0));
        assert!(!definition.repeatable);
        let directive = parse_directive("@d").unwrap();
        assert_eq!(directive.arguments.as_ref().map(Vec::len), Some(0));
    }

    #[test]
    fn parses_values() {
        let cases = [
            ("@d(a: \"simple\")", "@d(a: \"simple\")"),
            ("@d(a: \" white space \")", "@d(a: \" white space \")"),
            ("@d(a: \"quote \\\"\")", "@d(a: \"quote \\\"\")"),
            (
                "@d(a: \"escaped \\n\\r\\b\\t\\f\")",
                "@d(a: \"escaped \\n\\r\\b\\t\\f\")",
            ),
            ("@d(a: \"slashes \\\\ \\/\")", "@d(a: \"slashes \\\\ /\")"),
            (
                "@d(a: \"unescaped unicode outside BMP \u{1f600}\")",
                "@d(a: \"unescaped unicode outside BMP \u{1f600}\")",
            ),
            (
                "@d(a: \"unicode \\u1234\\u5678\\u90AB\\uCDEF\")",
                "@d(a: \"unicode \u{1234}\u{5678}\u{90ab}\u{cdef}\")",
            ),
            (
                "@d(a: \"unicode \\u{1234}\\u{5678}\\u{90AB}\\u{CDEF}\")",
                "@d(a: \"unicode \u{1234}\u{5678}\u{90ab}\u{cdef}\")",
            ),
            (
                "@d(a: \"string with unicode escape outside BMP \\u{1F600}\")",
                "@d(a: \"string with unicode escape outside BMP \u{1f600}\")",
            ),
            (
                "@d(a: \"string with minimal unicode escape \\u{0}\")",
                "@d(a: \"string with minimal unicode escape \\u0000\")",
            ),
            (
                "@d(a: \"string with maximal unicode escape \\u{10FFFF}\")",
                "@d(a: \"string with maximal unicode escape \u{10ffff}\")",
            ),
            (
                "@d(a: \"string with maximal minimal unicode escape \\u{00000000}\")",
                "@d(a: \"string with maximal minimal unicode escape \\u0000\")",
            ),
            (
                "@d(a: \"string with unicode surrogate pair escape \\uD83D\\uDE00\")",
                "@d(a: \"string with unicode surrogate pair escape \u{1f600}\")",
            ),
            (
                "@d(a: \"string with unicode surrogate pair escape \\uDBFF\\uDFFF\")",
                "@d(a: \"string with unicode surrogate pair escape \u{10ffff}\")",
            ),
            ("@d(a: \"\"\"simple\"\"\")", "@d(a: \"\"\"simple\"\"\")"),
            (
                "@d(a: \"\"\" white space \"\"\")",
                "@d(a: \"\"\" white space \"\"\")",
            ),
            (
                "@d(a: \"\"\"contains \" quote\"\"\")",
                "@d(a: \"\"\"contains \" quote\"\"\")",
            ),
            (
                "@d(a: \"\"\"contains \\\"\"\" triple quote\"\"\")",
                "@d(a: \"\"\"contains \\\"\"\" triple quote\"\"\")",
            ),
            (
                "@d(a: \"\"\"multi\nline\"\"\")",
                "@d(a: \"\"\"\nmulti\nline\n\"\"\")",
            ),
            (
                "@d(a: \"\"\"multi\rline\r\nnormalized\"\"\")",
                "@d(a: \"\"\"\nmulti\nline\nnormalized\n\"\"\")",
            ),
            (
                "@d(a: \"\"\"unescaped \\n\\r\\b\\t\\f\\u1234\"\"\")",
                "@d(a: \"\"\"unescaped \\n\\r\\b\\t\\f\\u1234\"\"\")",
            ),
            (
                "@d(a: \"\"\"unescaped unicode outside BMP \u{1f600}\"\"\")",
                "@d(a: \"\"\"unescaped unicode outside BMP \u{1f600}\"\"\")",
            ),
            (
                "@d(a: \"\"\"slashes \\\\ \\/\"\"\")",
                "@d(a: \"\"\"slashes \\\\ \\/\"\"\")",
            ),
            (
                "@d(a: \"\"\"\n\n        spans\n          multiple\n            lines\n\n        \"\"\")",
                "@d(a: \"\"\"\nspans\n  multiple\n    lines\n\"\"\")",
            ),
            (
                "@d(a: 4, b: -4, c: 9, d: 0, e: 4.123, f: -4.123, g: 0.123, h: 123e4, i: 123E4, j: 123e-4, k: 123e+4, l: -1.123e4, m: -1.123E4, n: -1.123e-4, o: -1.123e+4, p: -1.123e4567)",
                "@d(a: 4, b: -4, c: 9, d: 0, e: 4.123, f: -4.123, g: 0.123, h: 123e4, i: 123E4, j: 123e-4, k: 123e+4, l: -1.123e4, m: -1.123E4, n: -1.123e-4, o: -1.123e+4, p: -1.123e4567)",
            ),
            (
                "@d(a: [1, \"two\", THREE, true, false, null, {x: 1, y: [2]}], b: {})",
                "@d(a: [1, \"two\", THREE, true, false, null, {x: 1, y: [2]}], b: {})",
            ),
            ("@d(a: 1, )", "@d(a: 1)"),
            (
                "@d(a: \"contains \u{7} bell\")",
                "@d(a: \"contains \\u0007 bell\")",
            ),
            (
                "@d(a: \"\"\"contains \u{7} bell\"\"\")",
                "@d(a: \"\"\"contains \u{7} bell\"\"\")",
            ),
        ];
        for (body, printed) in cases {
            assert_eq!(
                print_directive(&parse_directive(body).unwrap()),
                printed,
                "{body:?}"
            );
        }
    }

    #[test]
    fn reports_lexer_errors() {
        let cases = [
            (
                "@d(a: $x)",
                "Syntax Error: Unexpected variable \"$x\" in constant value.",
            ),
            (
                "@d(a: \"unterminated)",
                "Syntax Error: Unterminated string.",
            ),
            (
                "@d(a: \"multi\nline\")",
                "Syntax Error: Unterminated string.",
            ),
            (
                "@d(a: \"bad \\z esc\")",
                "Syntax Error: Invalid character escape sequence: \"\\z\".",
            ),
            (
                "@d(a: \"bad \\x esc\")",
                "Syntax Error: Invalid character escape sequence: \"\\x\".",
            ),
            (
                "@d(a: \"bad \\u1 esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\u1 es\".",
            ),
            (
                "@d(a: \"bad \\u{} esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\u{}\".",
            ),
            (
                "@d(a: \"bad \\u{FXXX} esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\u{FX\".",
            ),
            (
                "@d(a: \"bad \\u{FFFF esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\u{FFFF \".",
            ),
            (
                "@d(a: \"bad \\u{110000} esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\u{110000}\".",
            ),
            (
                "@d(a: \"bad \\uD83D esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\uD83D\".",
            ),
            (
                "@d(a: \"bad \\uDE00 esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\uDE00\".",
            ),
            (
                "@d(a: \"bad \\uD83D\\u0041 esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\uD83D\".",
            ),
            (
                "@d(a: \"\"\"unterminated)",
                "Syntax Error: Unterminated string.",
            ),
            (
                "@d(a: 00)",
                "Syntax Error: Invalid number, unexpected digit after 0: \"0\".",
            ),
            (
                "@d(a: 01)",
                "Syntax Error: Invalid number, unexpected digit after 0: \"1\".",
            ),
            (
                "@d(a: 1.)",
                "Syntax Error: Invalid number, expected digit but got: \")\".",
            ),
            ("@d(a: .123)", "Syntax Error: Unexpected character: \".\"."),
            (
                "@d(a: 1.A)",
                "Syntax Error: Invalid number, expected digit but got: \"A\".",
            ),
            (
                "@d(a: -A)",
                "Syntax Error: Invalid number, expected digit but got: \"A\".",
            ),
            (
                "@d(a: 1.0e)",
                "Syntax Error: Invalid number, expected digit but got: \")\".",
            ),
            (
                "@d(a: 1.0eA)",
                "Syntax Error: Invalid number, expected digit but got: \"A\".",
            ),
            (
                "@d(a: 1.2e3e)",
                "Syntax Error: Invalid number, expected digit but got: \"e\".",
            ),
            (
                "@d(a: 1.23.4)",
                "Syntax Error: Invalid number, expected digit but got: \".\".",
            ),
            (
                "@d(a: 1_234)",
                "Syntax Error: Invalid number, expected digit but got: \"_\".",
            ),
            (
                "@d(a: 1\u{df})",
                "Syntax Error: Unexpected character: U+00DF.",
            ),
            (
                "@d(a: 1.23f)",
                "Syntax Error: Invalid number, expected digit but got: \"f\".",
            ),
            (
                "@d(a: 1.234_5)",
                "Syntax Error: Invalid number, expected digit but got: \"_\".",
            ),
            (
                "@d(a: 12e3.4)",
                "Syntax Error: Invalid number, expected digit but got: \".\".",
            ),
            ("@d ..", "Syntax Error: Unexpected character: \".\"."),
            ("@d ~", "Syntax Error: Unexpected character: \"~\"."),
            ("@d \u{0}", "Syntax Error: Unexpected character: U+0000."),
            ("@d \u{7}", "Syntax Error: Unexpected character: U+0007."),
            ("@d \u{203b}", "Syntax Error: Unexpected character: U+203B."),
            (
                "@d \u{1f600}",
                "Syntax Error: Unexpected character: U+1F600.",
            ),
            ("@d \"", "Syntax Error: Unterminated string."),
            ("@d ?", "Syntax Error: Unexpected character: \"?\"."),
            ("@d \u{aa}", "Syntax Error: Unexpected character: U+00AA."),
        ];
        for (body, message) in cases {
            assert_eq!(parse_directive(body).unwrap_err(), message, "{body:?}");
        }
    }

    #[test]
    fn reports_parser_errors() {
        let directive_cases = [
            ("", "Syntax Error: Expected \"@\", found <EOF>."),
            ("@", "Syntax Error: Expected Name, found <EOF>."),
            ("@d(a: $)", "Syntax Error: Unexpected \"$\"."),
            ("@d(a: )", "Syntax Error: Unexpected \")\"."),
            ("@d()", "Syntax Error: Expected Name, found \")\"."),
            ("@d @e", "Syntax Error: Expected <EOF>, found \"@\"."),
        ];
        for (body, message) in directive_cases {
            assert_eq!(parse_directive(body).unwrap_err(), message, "{body:?}");
        }
        let definition_cases = [
            (
                "directive @d on NOPE",
                "Syntax Error: Unexpected Name \"NOPE\".",
            ),
            (
                "directive @d",
                "Syntax Error: Expected \"on\", found <EOF>.",
            ),
            (
                "directive @d repeatable",
                "Syntax Error: Expected \"on\", found <EOF>.",
            ),
            (
                "directive d on FIELD",
                "Syntax Error: Expected \"@\", found Name \"d\".",
            ),
            (
                "directive @d(a) on FIELD",
                "Syntax Error: Expected \":\", found \")\".",
            ),
            (
                "directive @d(a: ) on FIELD",
                "Syntax Error: Expected Name, found \")\".",
            ),
            (
                "directive @d(a: [Int) on FIELD",
                "Syntax Error: Expected \"]\", found \")\".",
            ),
            (
                "\"desc\" type T",
                "Syntax Error: Expected \"directive\", found Name \"type\".",
            ),
        ];
        for (body, message) in definition_cases {
            assert_eq!(
                parse_directive_definition(body).unwrap_err(),
                message,
                "{body:?}"
            );
        }
    }
}
