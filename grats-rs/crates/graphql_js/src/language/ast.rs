//! Port of graphql-js `language/ast.ts`.
//!
//! PORT: Only the type system subset of the AST is ported, since Grats never
//! handles executable documents. Nodes deserialize from the JSON produced by
//! `encodeDocument` in `src/rs/codec.ts`, which is graphql-js's AST plus
//! Grats' metadata fields (see `src/GraphQLAstExtensions.ts`). Metadata fields
//! are modeled once ported code reads them. The others are ignored when
//! deserializing.

use serde::{Deserialize, Serialize};

use super::token_kind::TokenKind;

/// PORT: graphql-js locations reference their `Source` and tokens. Here a
/// location is an offset range into a source in the `SourceTable` held by the
/// TypeScript side (see `EncodedLocation` in `src/rs/codec.ts`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize)]
pub struct Location {
    /// Index into the TypeScript side's `SourceTable`.
    pub source: u32,
    /// The character offset at which this Node begins.
    pub start: u32,
    /// The character offset at which this Node ends.
    pub end: u32,
}

/// Represents a range of characters represented by a lexical token
/// within a Source.
///
/// PORT: graphql-js links tokens into a list with `prev` and `next`. Here the
/// `Lexer` keeps its tokens in a list.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Token {
    /// The kind of Token.
    pub kind: TokenKind,
    /// The character offset at which this Node begins.
    pub start: usize,
    /// The character offset at which this Node ends.
    pub end: usize,
    /// The 1-indexed line number on which this Token appears.
    pub line: usize,
    /// The 1-indexed column number at which this Token begins.
    pub column: usize,
    /// For non-punctuation tokens, represents the interpreted value of the token.
    pub value: Option<String>,
}

impl Token {
    pub fn new(
        kind: TokenKind,
        start: usize,
        end: usize,
        line: usize,
        column: usize,
        value: Option<String>,
    ) -> Self {
        Token {
            kind,
            start,
            end,
            line,
            column,
            value,
        }
    }
}

// Grats metadata (see `src/GraphQLAstExtensions.ts`)

/// A unique identifier for TypeScript nodes. Used to track data about nodes in
/// lookup data structures.
///
/// PORT: Declared in `src/utils/helpers.ts`.
pub type TsIdentifier = i64;

/// Identifier for NameNodes created after type resolution. Nothing looks these
/// up, so they don't need to be unique.
///
/// PORT: Declared in `src/utils/helpers.ts`.
pub const UNTRACKED_ID: TsIdentifier = -1;

fn untracked_id() -> TsIdentifier {
    UNTRACKED_ID
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDefinition {
    pub ts_module_path: String,
    pub export_name: Option<String>,
}

/// Describes the backing resolver for a field. This broadly matches the metadata
/// shape that is part of the public API of Grats, but also includes location
/// information as well as information about resolver with types which have not
/// yet been resolved.
///
/// PORT: Declared in `src/resolverSignature.ts`. Its location isn't read by
/// ported code, so it isn't modeled.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ResolverSignature {
    Property {
        name: Option<String>,
    },
    Method {
        name: Option<String>,
        arguments: Option<Vec<ResolverArgument>>,
    },
    #[serde(rename_all = "camelCase")]
    Function {
        path: String,
        export_name: Option<String>,
        arguments: Option<Vec<ResolverArgument>>,
    },
    #[serde(rename_all = "camelCase")]
    StaticMethod {
        path: String,
        export_name: Option<String>,
        name: String,
        arguments: Option<Vec<ResolverArgument>>,
    },
}

/// PORT: Declared in `src/resolverSignature.ts`.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ResolverArgument {
    Source {
        loc: Option<Location>,
    },
    ArgumentsObject {
        loc: Option<Location>,
    },
    Context {
        loc: Option<Location>,
    },
    /// PORT: `args` only contains context and derived context arguments.
    #[serde(rename_all = "camelCase")]
    DerivedContext {
        path: String,
        export_name: Option<String>,
        args: Vec<ResolverArgument>,
        loc: Option<Location>,
        r#async: bool,
    },
    Information {
        loc: Option<Location>,
    },
    #[serde(rename_all = "camelCase")]
    Named {
        name: String,
        loc: Option<Location>,
        input_definition: InputValueDefinitionNode,
    },
    #[serde(rename_all = "camelCase")]
    Unresolved {
        input_definition: InputValueDefinitionNodeOrResolverArg,
        loc: Option<Location>,
    },
}

impl ResolverArgument {
    pub fn loc(&self) -> Option<Location> {
        match self {
            ResolverArgument::Source { loc }
            | ResolverArgument::ArgumentsObject { loc }
            | ResolverArgument::Context { loc }
            | ResolverArgument::DerivedContext { loc, .. }
            | ResolverArgument::Information { loc }
            | ResolverArgument::Named { loc, .. }
            | ResolverArgument::Unresolved { loc, .. } => *loc,
        }
    }
}

/// At extraction time we don't know if a resolver arg is context, info, or a
/// positional GraphQL argument. If it's a positional argument, we need to ensure
/// it has a valid name. If it's just info or context, it's fine if it doesn't
/// have a name e.g. (destructured).
///
/// PORT: Declared in `src/resolverSignature.ts`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputValueDefinitionNodeOrResolverArg {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    // This is the only property that is different.
    pub name: DiagnosticHandleResult<NameNode>,
    pub r#type: TypeNode,
    pub default_value: Option<ConstValueNode>,
    pub directives: Option<Vec<ConstDirectiveNode>>,
}

/// PORT: A `DiagnosticResult<T>` (see `src/utils/DiagnosticError.ts`) made by
/// the extractor, whose error is a `DiagnosticHandle`.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DiagnosticHandleResult<T> {
    Ok { value: T },
    Error { err: DiagnosticHandle },
}

/// PORT: A diagnostic made by the extractor, but only reported to the user if
/// a later stage decides it applies. TypeScript keeps the diagnostic itself in
/// the AST. Here the AST refers to it by a handle, which is unique like a
/// `TsIdentifier`, so that the crate doesn't depend on Grats' diagnostics.
/// See `ExtractionSnapshot::diagnostics_by_handle`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticHandle {
    pub id: TsIdentifier,
}

// Name

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NameNode {
    pub loc: Option<Location>,
    pub value: String,
    /// Grats metadata: A unique identifier for the node. Used to track
    /// data about nodes in lookup data structures.
    ///
    /// Only meaningful from extraction through type resolution. Names created
    /// after that use `UNTRACKED_ID`.
    ///
    /// PORT: Missing on names parsed from GraphQL text, where TypeScript reads
    /// it as `undefined`. Neither finds anything when looked up.
    #[serde(default = "untracked_id")]
    pub ts_identifier: TsIdentifier,
}

// Document

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentNode {
    pub loc: Option<Location>,
    pub definitions: Vec<DefinitionNode>,
    pub token_count: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind")]
pub enum DefinitionNode {
    // TypeSystemDefinitionNode
    SchemaDefinition(SchemaDefinitionNode),
    ScalarTypeDefinition(ScalarTypeDefinitionNode),
    ObjectTypeDefinition(ObjectTypeDefinitionNode),
    InterfaceTypeDefinition(InterfaceTypeDefinitionNode),
    UnionTypeDefinition(UnionTypeDefinitionNode),
    EnumTypeDefinition(EnumTypeDefinitionNode),
    InputObjectTypeDefinition(InputObjectTypeDefinitionNode),
    DirectiveDefinition(DirectiveDefinitionNode),
    // TypeSystemExtensionNode
    SchemaExtension(SchemaExtensionNode),
    ScalarTypeExtension(ScalarTypeExtensionNode),
    ObjectTypeExtension(ObjectTypeExtensionNode),
    InterfaceTypeExtension(InterfaceTypeExtensionNode),
    UnionTypeExtension(UnionTypeExtensionNode),
    EnumTypeExtension(EnumTypeExtensionNode),
    InputObjectTypeExtension(InputObjectTypeExtensionNode),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OperationTypeNode {
    Query,
    Mutation,
    Subscription,
}

impl OperationTypeNode {
    pub fn as_str(self) -> &'static str {
        match self {
            OperationTypeNode::Query => "query",
            OperationTypeNode::Mutation => "mutation",
            OperationTypeNode::Subscription => "subscription",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConstArgumentNode {
    pub loc: Option<Location>,
    pub name: NameNode,
    pub value: ConstValueNode,
}

// Values

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind")]
pub enum ConstValueNode {
    IntValue(IntValueNode),
    FloatValue(FloatValueNode),
    StringValue(StringValueNode),
    BooleanValue(BooleanValueNode),
    NullValue(NullValueNode),
    EnumValue(EnumValueNode),
    ListValue(ConstListValueNode),
    ObjectValue(ConstObjectValueNode),
}

impl ConstValueNode {
    /// PORT: `valueNode.loc`, which every variant has.
    pub fn loc(&self) -> Option<Location> {
        match self {
            ConstValueNode::IntValue(v) => v.loc,
            ConstValueNode::FloatValue(v) => v.loc,
            ConstValueNode::StringValue(v) => v.loc,
            ConstValueNode::BooleanValue(v) => v.loc,
            ConstValueNode::NullValue(v) => v.loc,
            ConstValueNode::EnumValue(v) => v.loc,
            ConstValueNode::ListValue(v) => v.loc,
            ConstValueNode::ObjectValue(v) => v.loc,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct IntValueNode {
    pub loc: Option<Location>,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FloatValueNode {
    pub loc: Option<Location>,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StringValueNode {
    pub loc: Option<Location>,
    pub value: String,
    #[serde(default)]
    pub block: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BooleanValueNode {
    pub loc: Option<Location>,
    pub value: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NullValueNode {
    pub loc: Option<Location>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EnumValueNode {
    pub loc: Option<Location>,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConstListValueNode {
    pub loc: Option<Location>,
    pub values: Vec<ConstValueNode>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConstObjectValueNode {
    pub loc: Option<Location>,
    pub fields: Vec<ConstObjectFieldNode>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConstObjectFieldNode {
    pub loc: Option<Location>,
    pub name: NameNode,
    pub value: ConstValueNode,
}

// Directives

#[derive(Debug, Clone, Deserialize)]
pub struct ConstDirectiveNode {
    pub loc: Option<Location>,
    pub name: NameNode,
    pub arguments: Option<Vec<ConstArgumentNode>>,
}

// Type Reference

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind")]
pub enum TypeNode {
    NamedType(NamedTypeNode),
    ListType(ListTypeNode),
    NonNullType(NonNullTypeNode),
}

impl TypeNode {
    /// PORT: `typeNode.loc`, which every variant has.
    pub fn loc(&self) -> Option<Location> {
        match self {
            TypeNode::NamedType(t) => t.loc,
            TypeNode::ListType(t) => t.loc,
            TypeNode::NonNullType(t) => t.loc,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct NamedTypeNode {
    pub loc: Option<Location>,
    pub name: NameNode,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListTypeNode {
    pub loc: Option<Location>,
    pub r#type: Box<TypeNode>,
    /// Grats metadata: Whether the list type was defined as an AsyncIterable.
    /// Used to ensure that all fields on `Subscription` return an AsyncIterable.
    #[serde(default)]
    pub is_async_iterable: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NonNullTypeNode {
    pub loc: Option<Location>,
    pub r#type: Box<NullableTypeNode>,
}

/// The types a `NonNullTypeNode` may wrap.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind")]
pub enum NullableTypeNode {
    NamedType(NamedTypeNode),
    ListType(ListTypeNode),
}

/// PORT: graphql-js's node types are structural, so a `NullableTypeNode` is
/// already a `TypeNode`.
impl From<NullableTypeNode> for TypeNode {
    fn from(node: NullableTypeNode) -> Self {
        match node {
            NullableTypeNode::NamedType(t) => TypeNode::NamedType(t),
            NullableTypeNode::ListType(t) => TypeNode::ListType(t),
        }
    }
}

// Type System Definition

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub operation_types: Vec<OperationTypeDefinitionNode>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OperationTypeDefinitionNode {
    pub loc: Option<Location>,
    pub operation: OperationTypeNode,
    pub r#type: NamedTypeNode,
}

// Type Definition

#[derive(Debug, Clone, Deserialize)]
pub struct ScalarTypeDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    /// Grats metadata: The module path and export name of the scalar
    /// implementation. If null, the scalar is either a built-in scalar or a
    /// custom scalar that is not exported from a module.
    pub exported: Option<ExportDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObjectTypeDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub interfaces: Option<Vec<NamedTypeNode>>,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub fields: Option<Vec<FieldDefinitionNode>>,
    /// Grats metadata: Indicates that the type was materialized as part of
    /// generic type resolution.
    #[serde(default)]
    pub was_synthesized: bool,
    /// Grats metadata. PORT: Missing on types Grats synthesizes, where
    /// TypeScript reads it as `undefined`.
    #[serde(default)]
    pub has_type_name_field: bool,
    /// Grats metadata.
    pub exported: Option<ExportDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub arguments: Option<Vec<InputValueDefinitionNode>>,
    pub r#type: TypeNode,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    /// Grats metadata: Describes the backing resolver for a field. Eventually
    /// this gets transformed into a @resolver directive. However, we delay doing
    /// that to avoid repeated parsing, and to allow for unresolved types early
    /// on during compilation.
    pub resolver: Option<ResolverSignature>,
    /// Grats metadata.
    pub kills_parent_on_exception: Option<NameNode>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputValueDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub r#type: TypeNode,
    pub default_value: Option<ConstValueNode>,
    pub directives: Option<Vec<ConstDirectiveNode>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InterfaceTypeDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub interfaces: Option<Vec<NamedTypeNode>>,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub fields: Option<Vec<FieldDefinitionNode>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UnionTypeDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub types: Option<Vec<NamedTypeNode>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EnumTypeDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub values: Option<Vec<EnumValueDefinitionNode>>,
    /// Grats metadata: Export information for the enum.
    pub exported: Option<ExportDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnumValueDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    /// Grats metadata: The TypeScript name of the enum value.
    pub ts_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InputObjectTypeDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub fields: Option<Vec<InputValueDefinitionNode>>,
}

// Directive Definitions

#[derive(Debug, Clone, Deserialize)]
pub struct DirectiveDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub arguments: Option<Vec<InputValueDefinitionNode>>,
    #[serde(default)]
    pub repeatable: bool,
    pub locations: Vec<NameNode>,
}

// Type System Extensions

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaExtensionNode {
    pub loc: Option<Location>,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub operation_types: Option<Vec<OperationTypeDefinitionNode>>,
}

// Type Extensions

#[derive(Debug, Clone, Deserialize)]
pub struct ScalarTypeExtensionNode {
    pub loc: Option<Location>,
    pub name: NameNode,
    pub directives: Option<Vec<ConstDirectiveNode>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ObjectTypeExtensionNode {
    pub loc: Option<Location>,
    pub name: NameNode,
    pub interfaces: Option<Vec<NamedTypeNode>>,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub fields: Option<Vec<FieldDefinitionNode>>,
    /// Grats metadata: Indicates that we don't know yet if this is extending an interface
    /// or a type.
    #[serde(default)]
    pub may_be_interface: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InterfaceTypeExtensionNode {
    pub loc: Option<Location>,
    pub name: NameNode,
    pub interfaces: Option<Vec<NamedTypeNode>>,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub fields: Option<Vec<FieldDefinitionNode>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UnionTypeExtensionNode {
    pub loc: Option<Location>,
    pub name: NameNode,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub types: Option<Vec<NamedTypeNode>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EnumTypeExtensionNode {
    pub loc: Option<Location>,
    pub name: NameNode,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub values: Option<Vec<EnumValueDefinitionNode>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InputObjectTypeExtensionNode {
    pub loc: Option<Location>,
    pub name: NameNode,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub fields: Option<Vec<InputValueDefinitionNode>>,
}
