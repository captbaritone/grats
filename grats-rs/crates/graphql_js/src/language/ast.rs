//! Port of graphql-js `language/ast.ts`.
//!
//! PORT: Only the type system subset of the AST is ported, since Grats never
//! handles executable documents. Nodes deserialize from the JSON produced by
//! `encodeDocument` in `src/rs/codec.ts`, which is graphql-js's AST plus
//! Grats' metadata fields (see `src/GraphQLAstExtensions.ts`). Metadata fields
//! are modeled once ported code reads them. The others are ignored when
//! deserializing.

use serde::Deserialize;

/// PORT: graphql-js locations reference their `Source` and tokens. Here a
/// location is an offset range into a source in the `SourceTable` held by the
/// TypeScript side (see `EncodedLocation` in `src/rs/codec.ts`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub struct Location {
    /// Index into the TypeScript side's `SourceTable`.
    pub source: u32,
    /// The character offset at which this Node begins.
    pub start: u32,
    /// The character offset at which this Node ends.
    pub end: u32,
}

// Grats metadata (see `src/GraphQLAstExtensions.ts`)

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDefinition {
    pub ts_module_path: String,
    pub export_name: Option<String>,
}

// Name

#[derive(Debug, Clone, Deserialize)]
pub struct NameNode {
    pub loc: Option<Location>,
    pub value: String,
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

#[derive(Debug, Clone, Deserialize)]
pub struct NamedTypeNode {
    pub loc: Option<Location>,
    pub name: NameNode,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListTypeNode {
    pub loc: Option<Location>,
    pub r#type: Box<TypeNode>,
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
}

#[derive(Debug, Clone, Deserialize)]
pub struct ObjectTypeDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub interfaces: Option<Vec<NamedTypeNode>>,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub fields: Option<Vec<FieldDefinitionNode>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FieldDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub arguments: Option<Vec<InputValueDefinitionNode>>,
    pub r#type: TypeNode,
    pub directives: Option<Vec<ConstDirectiveNode>>,
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
pub struct EnumValueDefinitionNode {
    pub loc: Option<Location>,
    pub description: Option<StringValueNode>,
    pub name: NameNode,
    pub directives: Option<Vec<ConstDirectiveNode>>,
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
pub struct ObjectTypeExtensionNode {
    pub loc: Option<Location>,
    pub name: NameNode,
    pub interfaces: Option<Vec<NamedTypeNode>>,
    pub directives: Option<Vec<ConstDirectiveNode>>,
    pub fields: Option<Vec<FieldDefinitionNode>>,
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
