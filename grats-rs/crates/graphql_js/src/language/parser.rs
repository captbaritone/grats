//! Port of graphql-js `language/parser.ts`.
//!
//! PORT: Only the parsing of type system documents and constant values is
//! ported, since the ported AST only models those. Grats never passes parser
//! options, so their defaults are assumed.

use super::ast::BooleanValueNode;
use super::ast::{
    ConstArgumentNode, ConstDirectiveNode, ConstListValueNode, ConstObjectFieldNode,
    ConstObjectValueNode, ConstValueNode, DefinitionNode, DirectiveDefinitionNode, DocumentNode,
    EnumTypeDefinitionNode, EnumTypeExtensionNode, EnumValueDefinitionNode, EnumValueNode,
    FieldDefinitionNode, FloatValueNode, InputObjectTypeDefinitionNode,
    InputObjectTypeExtensionNode, InputValueDefinitionNode, IntValueNode,
    InterfaceTypeDefinitionNode, InterfaceTypeExtensionNode, ListTypeNode, Location, NameNode,
    NamedTypeNode, NonNullTypeNode, NullValueNode, NullableTypeNode, ObjectTypeDefinitionNode,
    ObjectTypeExtensionNode, OperationTypeDefinitionNode, OperationTypeNode,
    ScalarTypeDefinitionNode, ScalarTypeExtensionNode, SchemaDefinitionNode, SchemaExtensionNode,
    StringValueNode, Token, TypeNode, UNTRACKED_ID, UnionTypeDefinitionNode,
    UnionTypeExtensionNode,
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

/// Given a GraphQL source, parses it into a Document.
/// Throws GraphQLError if a syntax error is encountered.
pub fn parse(source: &Source) -> ParseResult<DocumentNode> {
    let mut parser = Parser::new(source);
    let mut document = parser.parse_document()?;
    document.token_count = Some(parser.token_count());
    Ok(document)
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
    token_counter: u32,
}

impl<'s> Parser<'s> {
    pub fn new(source: &'s Source) -> Self {
        Parser {
            lexer: Lexer::new(source),
            token_counter: 0,
        }
    }

    pub fn token_count(&self) -> u32 {
        self.token_counter
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

    // Implements the parsing rules in the Document section.

    /// Document : Definition+
    pub fn parse_document(&mut self) -> ParseResult<DocumentNode> {
        let start = self.lexer.token().clone();
        let definitions = self.many(TokenKind::Sof, Self::parse_definition, TokenKind::Eof)?;
        Ok(DocumentNode {
            loc: self.node(&start),
            definitions,
            token_count: None,
        })
    }

    /// Definition :
    ///   - ExecutableDefinition
    ///   - TypeSystemDefinition
    ///   - TypeSystemExtension
    ///
    /// ExecutableDefinition :
    ///   - OperationDefinition
    ///   - FragmentDefinition
    ///
    /// TypeSystemDefinition :
    ///   - SchemaDefinition
    ///   - TypeDefinition
    ///   - DirectiveDefinition
    ///
    /// TypeDefinition :
    ///   - ScalarTypeDefinition
    ///   - ObjectTypeDefinition
    ///   - InterfaceTypeDefinition
    ///   - UnionTypeDefinition
    ///   - EnumTypeDefinition
    ///   - InputObjectTypeDefinition
    ///
    /// PORT: Executable definitions, which the ported AST doesn't model, are
    /// reported as unexpected tokens.
    pub fn parse_definition(&mut self) -> ParseResult<DefinitionNode> {
        if self.peek(TokenKind::BraceL) {
            return Err(self.unexpected(None));
        }

        // Many definitions begin with a description and require a lookahead.
        let has_description = self.peek_description();
        let keyword_token = if has_description {
            self.lexer.lookahead()?.clone()
        } else {
            self.lexer.token().clone()
        };

        if keyword_token.kind == TokenKind::Name {
            match keyword_token.value.as_deref() {
                Some("schema") => {
                    return Ok(DefinitionNode::SchemaDefinition(
                        self.parse_schema_definition()?,
                    ));
                }
                Some("scalar") => {
                    return Ok(DefinitionNode::ScalarTypeDefinition(
                        self.parse_scalar_type_definition()?,
                    ));
                }
                Some("type") => {
                    return Ok(DefinitionNode::ObjectTypeDefinition(
                        self.parse_object_type_definition()?,
                    ));
                }
                Some("interface") => {
                    return Ok(DefinitionNode::InterfaceTypeDefinition(
                        self.parse_interface_type_definition()?,
                    ));
                }
                Some("union") => {
                    return Ok(DefinitionNode::UnionTypeDefinition(
                        self.parse_union_type_definition()?,
                    ));
                }
                Some("enum") => {
                    return Ok(DefinitionNode::EnumTypeDefinition(
                        self.parse_enum_type_definition()?,
                    ));
                }
                Some("input") => {
                    return Ok(DefinitionNode::InputObjectTypeDefinition(
                        self.parse_input_object_type_definition()?,
                    ));
                }
                Some("directive") => {
                    return Ok(DefinitionNode::DirectiveDefinition(
                        self.parse_directive_definition()?,
                    ));
                }
                _ => {}
            }

            if has_description {
                return Err(syntax_error(
                    self.lexer.source,
                    self.lexer.token().start,
                    "Unexpected description, descriptions are supported only on type definitions.",
                ));
            }

            if keyword_token.value.as_deref() == Some("extend") {
                return self.parse_type_system_extension();
            }
        }

        Err(self.unexpected(Some(&keyword_token)))
    }

    /// OperationType : one of query mutation subscription
    pub fn parse_operation_type(&mut self) -> ParseResult<OperationTypeNode> {
        let operation_token = self.expect_token(TokenKind::Name)?;
        match operation_token.value.as_deref() {
            Some("query") => Ok(OperationTypeNode::Query),
            Some("mutation") => Ok(OperationTypeNode::Mutation),
            Some("subscription") => Ok(OperationTypeNode::Subscription),
            _ => Err(self.unexpected(Some(&operation_token))),
        }
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
                        self.lexer.source,
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

    /// ```text
    /// SchemaDefinition : Description? schema Directives[Const]? { OperationTypeDefinition+ }
    /// ```
    pub fn parse_schema_definition(&mut self) -> ParseResult<SchemaDefinitionNode> {
        let start = self.lexer.token().clone();
        let description = self.parse_description()?;
        self.expect_keyword("schema")?;
        let directives = self.parse_const_directives()?;
        let operation_types = self.many(
            TokenKind::BraceL,
            Self::parse_operation_type_definition,
            TokenKind::BraceR,
        )?;
        Ok(SchemaDefinitionNode {
            loc: self.node(&start),
            description,
            directives: Some(directives),
            operation_types,
        })
    }

    /// OperationTypeDefinition : OperationType : NamedType
    pub fn parse_operation_type_definition(&mut self) -> ParseResult<OperationTypeDefinitionNode> {
        let start = self.lexer.token().clone();
        let operation = self.parse_operation_type()?;
        self.expect_token(TokenKind::Colon)?;
        let r#type = self.parse_named_type()?;
        Ok(OperationTypeDefinitionNode {
            loc: self.node(&start),
            operation,
            r#type,
        })
    }

    /// ScalarTypeDefinition : Description? scalar Name Directives[Const]?
    pub fn parse_scalar_type_definition(&mut self) -> ParseResult<ScalarTypeDefinitionNode> {
        let start = self.lexer.token().clone();
        let description = self.parse_description()?;
        self.expect_keyword("scalar")?;
        let name = self.parse_name()?;
        let directives = self.parse_const_directives()?;
        Ok(ScalarTypeDefinitionNode {
            loc: self.node(&start),
            description,
            name,
            directives: Some(directives),
            exported: None,
        })
    }

    /// ObjectTypeDefinition :
    ///   Description?
    ///   type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition?
    pub fn parse_object_type_definition(&mut self) -> ParseResult<ObjectTypeDefinitionNode> {
        let start = self.lexer.token().clone();
        let description = self.parse_description()?;
        self.expect_keyword("type")?;
        let name = self.parse_name()?;
        let interfaces = self.parse_implements_interfaces()?;
        let directives = self.parse_const_directives()?;
        let fields = self.parse_fields_definition()?;
        Ok(ObjectTypeDefinitionNode {
            loc: self.node(&start),
            description,
            name,
            interfaces: Some(interfaces),
            directives: Some(directives),
            fields: Some(fields),
            was_synthesized: false,
            has_type_name_field: false,
            exported: None,
        })
    }

    /// ImplementsInterfaces :
    ///   - implements `&`? NamedType
    ///   - ImplementsInterfaces & NamedType
    pub fn parse_implements_interfaces(&mut self) -> ParseResult<Vec<NamedTypeNode>> {
        if self.expect_optional_keyword("implements")? {
            self.delimited_many(TokenKind::Amp, Self::parse_named_type)
        } else {
            Ok(Vec::new())
        }
    }

    /// ```text
    /// FieldsDefinition : { FieldDefinition+ }
    /// ```
    pub fn parse_fields_definition(&mut self) -> ParseResult<Vec<FieldDefinitionNode>> {
        self.optional_many(
            TokenKind::BraceL,
            Self::parse_field_definition,
            TokenKind::BraceR,
        )
    }

    /// FieldDefinition :
    ///   - Description? Name ArgumentsDefinition? : Type Directives[Const]?
    pub fn parse_field_definition(&mut self) -> ParseResult<FieldDefinitionNode> {
        let start = self.lexer.token().clone();
        let description = self.parse_description()?;
        let name = self.parse_name()?;
        let args = self.parse_argument_defs()?;
        self.expect_token(TokenKind::Colon)?;
        let r#type = self.parse_type_reference()?;
        let directives = self.parse_const_directives()?;
        Ok(FieldDefinitionNode {
            loc: self.node(&start),
            description,
            name,
            arguments: Some(args),
            r#type,
            directives: Some(directives),
            resolver: None,
            kills_parent_on_exception: None,
        })
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

    /// InterfaceTypeDefinition :
    ///   - Description? interface Name Directives[Const]? FieldsDefinition?
    pub fn parse_interface_type_definition(&mut self) -> ParseResult<InterfaceTypeDefinitionNode> {
        let start = self.lexer.token().clone();
        let description = self.parse_description()?;
        self.expect_keyword("interface")?;
        let name = self.parse_name()?;
        let interfaces = self.parse_implements_interfaces()?;
        let directives = self.parse_const_directives()?;
        let fields = self.parse_fields_definition()?;
        Ok(InterfaceTypeDefinitionNode {
            loc: self.node(&start),
            description,
            name,
            interfaces: Some(interfaces),
            directives: Some(directives),
            fields: Some(fields),
        })
    }

    /// UnionTypeDefinition :
    ///   - Description? union Name Directives[Const]? UnionMemberTypes?
    pub fn parse_union_type_definition(&mut self) -> ParseResult<UnionTypeDefinitionNode> {
        let start = self.lexer.token().clone();
        let description = self.parse_description()?;
        self.expect_keyword("union")?;
        let name = self.parse_name()?;
        let directives = self.parse_const_directives()?;
        let types = self.parse_union_member_types()?;
        Ok(UnionTypeDefinitionNode {
            loc: self.node(&start),
            description,
            name,
            directives: Some(directives),
            types: Some(types),
        })
    }

    /// UnionMemberTypes :
    ///   - = `|`? NamedType
    ///   - UnionMemberTypes | NamedType
    pub fn parse_union_member_types(&mut self) -> ParseResult<Vec<NamedTypeNode>> {
        if self.expect_optional_token(TokenKind::Equals)? {
            self.delimited_many(TokenKind::Pipe, Self::parse_named_type)
        } else {
            Ok(Vec::new())
        }
    }

    /// EnumTypeDefinition :
    ///   - Description? enum Name Directives[Const]? EnumValuesDefinition?
    pub fn parse_enum_type_definition(&mut self) -> ParseResult<EnumTypeDefinitionNode> {
        let start = self.lexer.token().clone();
        let description = self.parse_description()?;
        self.expect_keyword("enum")?;
        let name = self.parse_name()?;
        let directives = self.parse_const_directives()?;
        let values = self.parse_enum_values_definition()?;
        Ok(EnumTypeDefinitionNode {
            loc: self.node(&start),
            description,
            name,
            directives: Some(directives),
            values: Some(values),
            exported: None,
        })
    }

    /// ```text
    /// EnumValuesDefinition : { EnumValueDefinition+ }
    /// ```
    pub fn parse_enum_values_definition(&mut self) -> ParseResult<Vec<EnumValueDefinitionNode>> {
        self.optional_many(
            TokenKind::BraceL,
            Self::parse_enum_value_definition,
            TokenKind::BraceR,
        )
    }

    /// EnumValueDefinition : Description? EnumValue Directives[Const]?
    pub fn parse_enum_value_definition(&mut self) -> ParseResult<EnumValueDefinitionNode> {
        let start = self.lexer.token().clone();
        let description = self.parse_description()?;
        let name = self.parse_enum_value_name()?;
        let directives = self.parse_const_directives()?;
        Ok(EnumValueDefinitionNode {
            loc: self.node(&start),
            description,
            name,
            directives: Some(directives),
            ts_name: None,
        })
    }

    /// EnumValue : Name but not `true`, `false` or `null`
    pub fn parse_enum_value_name(&mut self) -> ParseResult<NameNode> {
        let token = self.lexer.token();
        if matches!(token.value.as_deref(), Some("true" | "false" | "null")) {
            return Err(syntax_error(
                self.lexer.source,
                token.start,
                &format!(
                    "{} is reserved and cannot be used for an enum value.",
                    get_token_desc(token)
                ),
            ));
        }
        self.parse_name()
    }

    /// InputObjectTypeDefinition :
    ///   - Description? input Name Directives[Const]? InputFieldsDefinition?
    pub fn parse_input_object_type_definition(
        &mut self,
    ) -> ParseResult<InputObjectTypeDefinitionNode> {
        let start = self.lexer.token().clone();
        let description = self.parse_description()?;
        self.expect_keyword("input")?;
        let name = self.parse_name()?;
        let directives = self.parse_const_directives()?;
        let fields = self.parse_input_fields_definition()?;
        Ok(InputObjectTypeDefinitionNode {
            loc: self.node(&start),
            description,
            name,
            directives: Some(directives),
            fields: Some(fields),
        })
    }

    /// ```text
    /// InputFieldsDefinition : { InputValueDefinition+ }
    /// ```
    pub fn parse_input_fields_definition(&mut self) -> ParseResult<Vec<InputValueDefinitionNode>> {
        self.optional_many(
            TokenKind::BraceL,
            Self::parse_input_value_def,
            TokenKind::BraceR,
        )
    }

    /// TypeSystemExtension :
    ///   - SchemaExtension
    ///   - TypeExtension
    ///
    /// TypeExtension :
    ///   - ScalarTypeExtension
    ///   - ObjectTypeExtension
    ///   - InterfaceTypeExtension
    ///   - UnionTypeExtension
    ///   - EnumTypeExtension
    ///   - InputObjectTypeDefinition
    pub fn parse_type_system_extension(&mut self) -> ParseResult<DefinitionNode> {
        let keyword_token = self.lexer.lookahead()?.clone();

        if keyword_token.kind == TokenKind::Name {
            match keyword_token.value.as_deref() {
                Some("schema") => {
                    return Ok(DefinitionNode::SchemaExtension(
                        self.parse_schema_extension()?,
                    ));
                }
                Some("scalar") => {
                    return Ok(DefinitionNode::ScalarTypeExtension(
                        self.parse_scalar_type_extension()?,
                    ));
                }
                Some("type") => {
                    return Ok(DefinitionNode::ObjectTypeExtension(
                        self.parse_object_type_extension()?,
                    ));
                }
                Some("interface") => {
                    return Ok(DefinitionNode::InterfaceTypeExtension(
                        self.parse_interface_type_extension()?,
                    ));
                }
                Some("union") => {
                    return Ok(DefinitionNode::UnionTypeExtension(
                        self.parse_union_type_extension()?,
                    ));
                }
                Some("enum") => {
                    return Ok(DefinitionNode::EnumTypeExtension(
                        self.parse_enum_type_extension()?,
                    ));
                }
                Some("input") => {
                    return Ok(DefinitionNode::InputObjectTypeExtension(
                        self.parse_input_object_type_extension()?,
                    ));
                }
                _ => {}
            }
        }

        Err(self.unexpected(Some(&keyword_token)))
    }

    /// ```text
    /// SchemaExtension :
    ///  - extend schema Directives[Const]? { OperationTypeDefinition+ }
    ///  - extend schema Directives[Const]
    /// ```
    pub fn parse_schema_extension(&mut self) -> ParseResult<SchemaExtensionNode> {
        let start = self.lexer.token().clone();
        self.expect_keyword("extend")?;
        self.expect_keyword("schema")?;
        let directives = self.parse_const_directives()?;
        let operation_types = self.optional_many(
            TokenKind::BraceL,
            Self::parse_operation_type_definition,
            TokenKind::BraceR,
        )?;
        if directives.is_empty() && operation_types.is_empty() {
            return Err(self.unexpected(None));
        }
        Ok(SchemaExtensionNode {
            loc: self.node(&start),
            directives: Some(directives),
            operation_types: Some(operation_types),
        })
    }

    /// ScalarTypeExtension :
    ///   - extend scalar Name Directives[Const]
    pub fn parse_scalar_type_extension(&mut self) -> ParseResult<ScalarTypeExtensionNode> {
        let start = self.lexer.token().clone();
        self.expect_keyword("extend")?;
        self.expect_keyword("scalar")?;
        let name = self.parse_name()?;
        let directives = self.parse_const_directives()?;
        if directives.is_empty() {
            return Err(self.unexpected(None));
        }
        Ok(ScalarTypeExtensionNode {
            loc: self.node(&start),
            name,
            directives: Some(directives),
        })
    }

    /// ObjectTypeExtension :
    ///  - extend type Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
    ///  - extend type Name ImplementsInterfaces? Directives[Const]
    ///  - extend type Name ImplementsInterfaces
    pub fn parse_object_type_extension(&mut self) -> ParseResult<ObjectTypeExtensionNode> {
        let start = self.lexer.token().clone();
        self.expect_keyword("extend")?;
        self.expect_keyword("type")?;
        let name = self.parse_name()?;
        let interfaces = self.parse_implements_interfaces()?;
        let directives = self.parse_const_directives()?;
        let fields = self.parse_fields_definition()?;
        if interfaces.is_empty() && directives.is_empty() && fields.is_empty() {
            return Err(self.unexpected(None));
        }
        Ok(ObjectTypeExtensionNode {
            loc: self.node(&start),
            name,
            interfaces: Some(interfaces),
            directives: Some(directives),
            fields: Some(fields),
            may_be_interface: false,
        })
    }

    /// InterfaceTypeExtension :
    ///  - extend interface Name ImplementsInterfaces? Directives[Const]? FieldsDefinition
    ///  - extend interface Name ImplementsInterfaces? Directives[Const]
    ///  - extend interface Name ImplementsInterfaces
    pub fn parse_interface_type_extension(&mut self) -> ParseResult<InterfaceTypeExtensionNode> {
        let start = self.lexer.token().clone();
        self.expect_keyword("extend")?;
        self.expect_keyword("interface")?;
        let name = self.parse_name()?;
        let interfaces = self.parse_implements_interfaces()?;
        let directives = self.parse_const_directives()?;
        let fields = self.parse_fields_definition()?;
        if interfaces.is_empty() && directives.is_empty() && fields.is_empty() {
            return Err(self.unexpected(None));
        }
        Ok(InterfaceTypeExtensionNode {
            loc: self.node(&start),
            name,
            interfaces: Some(interfaces),
            directives: Some(directives),
            fields: Some(fields),
        })
    }

    /// UnionTypeExtension :
    ///   - extend union Name Directives[Const]? UnionMemberTypes
    ///   - extend union Name Directives[Const]
    pub fn parse_union_type_extension(&mut self) -> ParseResult<UnionTypeExtensionNode> {
        let start = self.lexer.token().clone();
        self.expect_keyword("extend")?;
        self.expect_keyword("union")?;
        let name = self.parse_name()?;
        let directives = self.parse_const_directives()?;
        let types = self.parse_union_member_types()?;
        if directives.is_empty() && types.is_empty() {
            return Err(self.unexpected(None));
        }
        Ok(UnionTypeExtensionNode {
            loc: self.node(&start),
            name,
            directives: Some(directives),
            types: Some(types),
        })
    }

    /// EnumTypeExtension :
    ///   - extend enum Name Directives[Const]? EnumValuesDefinition
    ///   - extend enum Name Directives[Const]
    pub fn parse_enum_type_extension(&mut self) -> ParseResult<EnumTypeExtensionNode> {
        let start = self.lexer.token().clone();
        self.expect_keyword("extend")?;
        self.expect_keyword("enum")?;
        let name = self.parse_name()?;
        let directives = self.parse_const_directives()?;
        let values = self.parse_enum_values_definition()?;
        if directives.is_empty() && values.is_empty() {
            return Err(self.unexpected(None));
        }
        Ok(EnumTypeExtensionNode {
            loc: self.node(&start),
            name,
            directives: Some(directives),
            values: Some(values),
        })
    }

    /// InputObjectTypeExtension :
    ///   - extend input Name Directives[Const]? InputFieldsDefinition
    ///   - extend input Name Directives[Const]
    pub fn parse_input_object_type_extension(
        &mut self,
    ) -> ParseResult<InputObjectTypeExtensionNode> {
        let start = self.lexer.token().clone();
        self.expect_keyword("extend")?;
        self.expect_keyword("input")?;
        let name = self.parse_name()?;
        let directives = self.parse_const_directives()?;
        let fields = self.parse_input_fields_definition()?;
        if directives.is_empty() && fields.is_empty() {
            return Err(self.unexpected(None));
        }
        Ok(InputObjectTypeExtensionNode {
            loc: self.node(&start),
            name,
            directives: Some(directives),
            fields: Some(fields),
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
            start: start_token.start as u32,
            end: self.lexer.last_token().end as u32,
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
            self.lexer.source,
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
                self.lexer.source,
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
            self.lexer.source,
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
    /// This list begins with a lex token of openKind and ends with a lex token of closeKind.
    /// Advances the parser to the next lex token after the closing token.
    pub fn many<T>(
        &mut self,
        open_kind: TokenKind,
        parse_fn: fn(&mut Self) -> ParseResult<T>,
        close_kind: TokenKind,
    ) -> ParseResult<Vec<T>> {
        self.expect_token(open_kind)?;
        let mut nodes = Vec::new();
        loop {
            nodes.push(parse_fn(self)?);
            if self.expect_optional_token(close_kind)? {
                break;
            }
        }
        Ok(nodes)
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

    /// PORT: graphql-js also enforces the `maxTokens` option, which Grats never
    /// passes.
    fn advance_lexer(&mut self) -> ParseResult<()> {
        let token = self.lexer.advance()?;
        if token.kind != TokenKind::Eof {
            self.token_counter += 1;
        }
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
    use super::parse;
    use crate::language::ast::{DefinitionNode, Location};
    use crate::language::printer::print;
    use crate::language::source::Source;
    use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction, visit};

    // Expectations are from graphql-js.

    fn source(body: &str) -> Source {
        Source::new(body.to_string(), "GraphQL request".to_string(), 3)
    }

    struct Locations(Vec<(u32, u32)>);

    impl<'n> ASTVisitor<'n> for Locations {
        fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
            let Location { source, start, end } = node.loc().unwrap();
            assert_eq!(source, 3);
            self.0.push((start, end));
            VisitAction::Continue
        }
    }

    #[test]
    fn records_node_locations() {
        let document = parse(&source(
            "\"d\" type T implements A @x(a: [1]) { f(b: Int = 1): [T!] }",
        ))
        .unwrap();
        let mut locations = Locations(Vec::new());
        visit(&document, &mut locations);
        assert_eq!(
            locations.0,
            [
                (0, 58),
                (0, 58),
                (0, 3),
                (9, 10),
                (22, 23),
                (22, 23),
                (24, 34),
                (25, 26),
                (27, 33),
                (27, 28),
                (30, 33),
                (31, 32),
                (37, 56),
                (37, 38),
                (39, 49),
                (39, 40),
                (42, 45),
                (42, 45),
                (48, 49),
                (52, 56),
                (53, 55),
                (53, 54),
                (53, 54),
            ]
        );
        assert_eq!(document.token_count, Some(29));
    }

    #[test]
    fn parses_optional_lists_as_empty() {
        let document = parse(&source("type T")).unwrap();
        let DefinitionNode::ObjectTypeDefinition(node) = &document.definitions[0] else {
            panic!("Expected an object type definition");
        };
        assert!(node.description.is_none());
        assert_eq!(node.interfaces.as_ref().map(Vec::len), Some(0));
        assert_eq!(node.directives.as_ref().map(Vec::len), Some(0));
        assert_eq!(node.fields.as_ref().map(Vec::len), Some(0));
    }

    #[test]
    fn parses_values() {
        let cases = [
            ("scalar S @d(a: \"simple\")", "scalar S @d(a: \"simple\")"),
            (
                "scalar S @d(a: \" white space \")",
                "scalar S @d(a: \" white space \")",
            ),
            (
                "scalar S @d(a: \"quote \\\"\")",
                "scalar S @d(a: \"quote \\\"\")",
            ),
            (
                "scalar S @d(a: \"escaped \\n\\r\\b\\t\\f\")",
                "scalar S @d(a: \"escaped \\n\\r\\b\\t\\f\")",
            ),
            (
                "scalar S @d(a: \"slashes \\\\ \\/\")",
                "scalar S @d(a: \"slashes \\\\ /\")",
            ),
            (
                "scalar S @d(a: \"unescaped unicode outside BMP \u{1f600}\")",
                "scalar S @d(a: \"unescaped unicode outside BMP \u{1f600}\")",
            ),
            (
                "scalar S @d(a: \"unicode \\u1234\\u5678\\u90AB\\uCDEF\")",
                "scalar S @d(a: \"unicode \u{1234}\u{5678}\u{90ab}\u{cdef}\")",
            ),
            (
                "scalar S @d(a: \"unicode \\u{1234}\\u{5678}\\u{90AB}\\u{CDEF}\")",
                "scalar S @d(a: \"unicode \u{1234}\u{5678}\u{90ab}\u{cdef}\")",
            ),
            (
                "scalar S @d(a: \"string with unicode escape outside BMP \\u{1F600}\")",
                "scalar S @d(a: \"string with unicode escape outside BMP \u{1f600}\")",
            ),
            (
                "scalar S @d(a: \"string with minimal unicode escape \\u{0}\")",
                "scalar S @d(a: \"string with minimal unicode escape \\u0000\")",
            ),
            (
                "scalar S @d(a: \"string with maximal unicode escape \\u{10FFFF}\")",
                "scalar S @d(a: \"string with maximal unicode escape \u{10ffff}\")",
            ),
            (
                "scalar S @d(a: \"string with maximal minimal unicode escape \\u{00000000}\")",
                "scalar S @d(a: \"string with maximal minimal unicode escape \\u0000\")",
            ),
            (
                "scalar S @d(a: \"string with unicode surrogate pair escape \\uD83D\\uDE00\")",
                "scalar S @d(a: \"string with unicode surrogate pair escape \u{1f600}\")",
            ),
            (
                "scalar S @d(a: \"string with unicode surrogate pair escape \\uDBFF\\uDFFF\")",
                "scalar S @d(a: \"string with unicode surrogate pair escape \u{10ffff}\")",
            ),
            (
                "scalar S @d(a: \"\"\"simple\"\"\")",
                "scalar S @d(a: \"\"\"simple\"\"\")",
            ),
            (
                "scalar S @d(a: \"\"\" white space \"\"\")",
                "scalar S @d(a: \"\"\" white space \"\"\")",
            ),
            (
                "scalar S @d(a: \"\"\"contains \" quote\"\"\")",
                "scalar S @d(a: \"\"\"contains \" quote\"\"\")",
            ),
            (
                "scalar S @d(a: \"\"\"contains \\\"\"\" triple quote\"\"\")",
                "scalar S @d(a: \"\"\"contains \\\"\"\" triple quote\"\"\")",
            ),
            (
                "scalar S @d(a: \"\"\"multi\nline\"\"\")",
                "scalar S @d(a: \"\"\"\nmulti\nline\n\"\"\")",
            ),
            (
                "scalar S @d(a: \"\"\"multi\rline\r\nnormalized\"\"\")",
                "scalar S @d(a: \"\"\"\nmulti\nline\nnormalized\n\"\"\")",
            ),
            (
                "scalar S @d(a: \"\"\"unescaped \\n\\r\\b\\t\\f\\u1234\"\"\")",
                "scalar S @d(a: \"\"\"unescaped \\n\\r\\b\\t\\f\\u1234\"\"\")",
            ),
            (
                "scalar S @d(a: \"\"\"unescaped unicode outside BMP \u{1f600}\"\"\")",
                "scalar S @d(a: \"\"\"unescaped unicode outside BMP \u{1f600}\"\"\")",
            ),
            (
                "scalar S @d(a: \"\"\"slashes \\\\ \\/\"\"\")",
                "scalar S @d(a: \"\"\"slashes \\\\ \\/\"\"\")",
            ),
            (
                "scalar S @d(a: \"\"\"\n\n        spans\n          multiple\n            lines\n\n        \"\"\")",
                "scalar S @d(a: \"\"\"\nspans\n  multiple\n    lines\n\"\"\")",
            ),
            (
                "scalar S @d(a: 4, b: -4, c: 9, d: 0, e: 4.123, f: -4.123, g: 0.123, h: 123e4, i: 123E4, j: 123e-4, k: 123e+4, l: -1.123e4, m: -1.123E4, n: -1.123e-4, o: -1.123e+4, p: -1.123e4567)",
                "scalar S @d(a: 4, b: -4, c: 9, d: 0, e: 4.123, f: -4.123, g: 0.123, h: 123e4, i: 123E4, j: 123e-4, k: 123e+4, l: -1.123e4, m: -1.123E4, n: -1.123e-4, o: -1.123e+4, p: -1.123e4567)",
            ),
            (
                "scalar S @d(a: [1, \"two\", THREE, true, false, null, {x: 1, y: [2]}], b: {})",
                "scalar S @d(a: [1, \"two\", THREE, true, false, null, {x: 1, y: [2]}], b: {})",
            ),
            ("scalar S @d(a: 1, )", "scalar S @d(a: 1)"),
            (
                "scalar S @d(a: \"contains \u{7} bell\")",
                "scalar S @d(a: \"contains \\u0007 bell\")",
            ),
            (
                "scalar S @d(a: \"\"\"contains \u{7} bell\"\"\")",
                "scalar S @d(a: \"\"\"contains \u{7} bell\"\"\")",
            ),
        ];
        for (body, printed) in cases {
            assert_eq!(print(&parse(&source(body)).unwrap()), printed, "{body:?}");
        }
    }

    #[test]
    fn reports_lexer_errors() {
        let cases = [
            (
                "\"desc\" extend type T @d",
                "Syntax Error: Unexpected description, descriptions are supported only on type definitions.",
            ),
            (
                "\"desc\" foo",
                "Syntax Error: Unexpected description, descriptions are supported only on type definitions.",
            ),
            (
                "scalar S @d(a: $x)",
                "Syntax Error: Unexpected variable \"$x\" in constant value.",
            ),
            (
                "scalar S @d(a: \"unterminated)",
                "Syntax Error: Unterminated string.",
            ),
            (
                "scalar S @d(a: \"multi\nline\")",
                "Syntax Error: Unterminated string.",
            ),
            (
                "scalar S @d(a: \"bad \\z esc\")",
                "Syntax Error: Invalid character escape sequence: \"\\z\".",
            ),
            (
                "scalar S @d(a: \"bad \\x esc\")",
                "Syntax Error: Invalid character escape sequence: \"\\x\".",
            ),
            (
                "scalar S @d(a: \"bad \\u1 esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\u1 es\".",
            ),
            (
                "scalar S @d(a: \"bad \\u{} esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\u{}\".",
            ),
            (
                "scalar S @d(a: \"bad \\u{FXXX} esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\u{FX\".",
            ),
            (
                "scalar S @d(a: \"bad \\u{FFFF esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\u{FFFF \".",
            ),
            (
                "scalar S @d(a: \"bad \\u{110000} esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\u{110000}\".",
            ),
            (
                "scalar S @d(a: \"bad \\uD83D esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\uD83D\".",
            ),
            (
                "scalar S @d(a: \"bad \\uDE00 esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\uDE00\".",
            ),
            (
                "scalar S @d(a: \"bad \\uD83D\\u0041 esc\")",
                "Syntax Error: Invalid Unicode escape sequence: \"\\uD83D\".",
            ),
            (
                "scalar S @d(a: \"\"\"unterminated)",
                "Syntax Error: Unterminated string.",
            ),
            (
                "scalar S @d(a: 00)",
                "Syntax Error: Invalid number, unexpected digit after 0: \"0\".",
            ),
            (
                "scalar S @d(a: 01)",
                "Syntax Error: Invalid number, unexpected digit after 0: \"1\".",
            ),
            (
                "scalar S @d(a: 1.)",
                "Syntax Error: Invalid number, expected digit but got: \")\".",
            ),
            (
                "scalar S @d(a: .123)",
                "Syntax Error: Unexpected character: \".\".",
            ),
            (
                "scalar S @d(a: 1.A)",
                "Syntax Error: Invalid number, expected digit but got: \"A\".",
            ),
            (
                "scalar S @d(a: -A)",
                "Syntax Error: Invalid number, expected digit but got: \"A\".",
            ),
            (
                "scalar S @d(a: 1.0e)",
                "Syntax Error: Invalid number, expected digit but got: \")\".",
            ),
            (
                "scalar S @d(a: 1.0eA)",
                "Syntax Error: Invalid number, expected digit but got: \"A\".",
            ),
            (
                "scalar S @d(a: 1.2e3e)",
                "Syntax Error: Invalid number, expected digit but got: \"e\".",
            ),
            (
                "scalar S @d(a: 1.23.4)",
                "Syntax Error: Invalid number, expected digit but got: \".\".",
            ),
            (
                "scalar S @d(a: 1_234)",
                "Syntax Error: Invalid number, expected digit but got: \"_\".",
            ),
            (
                "scalar S @d(a: 1\u{df})",
                "Syntax Error: Unexpected character: U+00DF.",
            ),
            (
                "scalar S @d(a: 1.23f)",
                "Syntax Error: Invalid number, expected digit but got: \"f\".",
            ),
            (
                "scalar S @d(a: 1.234_5)",
                "Syntax Error: Invalid number, expected digit but got: \"_\".",
            ),
            (
                "scalar S @d(a: 12e3.4)",
                "Syntax Error: Invalid number, expected digit but got: \".\".",
            ),
            ("scalar S ..", "Syntax Error: Unexpected character: \".\"."),
            ("scalar S ~", "Syntax Error: Unexpected character: \"~\"."),
            (
                "scalar S \u{0}",
                "Syntax Error: Unexpected character: U+0000.",
            ),
            (
                "scalar S \u{7}",
                "Syntax Error: Unexpected character: U+0007.",
            ),
            (
                "scalar S \u{203b}",
                "Syntax Error: Unexpected character: U+203B.",
            ),
            (
                "scalar S \u{1f600}",
                "Syntax Error: Unexpected character: U+1F600.",
            ),
            ("scalar S \"", "Syntax Error: Unterminated string."),
            ("scalar S ?", "Syntax Error: Unexpected character: \"?\"."),
            (
                "scalar S \u{aa}",
                "Syntax Error: Unexpected character: U+00AA.",
            ),
        ];
        for (body, message) in cases {
            assert_eq!(
                parse(&source(body)).unwrap_err().message,
                message,
                "{body:?}"
            );
        }
    }

    #[test]
    fn reports_parser_errors() {
        let cases = [
            ("", "Syntax Error: Unexpected <EOF>."),
            (" ", "Syntax Error: Unexpected <EOF>."),
            ("type", "Syntax Error: Expected Name, found <EOF>."),
            ("type T {", "Syntax Error: Expected Name, found <EOF>."),
            ("type T { }", "Syntax Error: Expected Name, found \"}\"."),
            ("type T { f }", "Syntax Error: Expected \":\", found \"}\"."),
            ("type T { f: }", "Syntax Error: Expected Name, found \"}\"."),
            (
                "enum E { true }",
                "Syntax Error: Name \"true\" is reserved and cannot be used for an enum value.",
            ),
            (
                "enum E { null }",
                "Syntax Error: Name \"null\" is reserved and cannot be used for an enum value.",
            ),
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
            ("extend scalar S", "Syntax Error: Unexpected <EOF>."),
            ("extend type T", "Syntax Error: Unexpected <EOF>."),
            ("extend interface I", "Syntax Error: Unexpected <EOF>."),
            ("extend union U", "Syntax Error: Unexpected <EOF>."),
            ("extend enum E", "Syntax Error: Unexpected <EOF>."),
            ("extend input I", "Syntax Error: Unexpected <EOF>."),
            ("extend schema", "Syntax Error: Unexpected <EOF>."),
            ("extend foo", "Syntax Error: Unexpected Name \"foo\"."),
            ("extend", "Syntax Error: Unexpected <EOF>."),
            ("foo", "Syntax Error: Unexpected Name \"foo\"."),
            ("scalar S @d(a: $)", "Syntax Error: Unexpected \"$\"."),
            ("scalar S @d(a: )", "Syntax Error: Unexpected \")\"."),
            ("scalar S @d()", "Syntax Error: Expected Name, found \")\"."),
            (
                "schema { foo: Q }",
                "Syntax Error: Unexpected Name \"foo\".",
            ),
        ];
        for (body, message) in cases {
            assert_eq!(
                parse(&source(body)).unwrap_err().message,
                message,
                "{body:?}"
            );
        }
    }

    #[test]
    fn rejects_executable_definitions() {
        assert_eq!(
            parse(&source("{ f }")).unwrap_err().message,
            "Syntax Error: Unexpected \"{\"."
        );
        assert_eq!(
            parse(&source("query Q { f }")).unwrap_err().message,
            "Syntax Error: Unexpected Name \"query\"."
        );
    }
}
