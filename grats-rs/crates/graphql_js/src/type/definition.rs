//! Port of graphql-js `type/definition.ts`.
//!
//! PORT: graphql-js types are objects which reference each other directly, and
//! compute their fields, interfaces and union members lazily ("thunks") so that
//! they can reference each other in cycles. Here named types live in a
//! `TypeArena`, owned by the schema, and reference each other by `TypeId`.
//! Thunked data is computed by the schema builder before the schema is
//! constructed and is read through the same getters as in graphql-js.
//!
//! Constructors don't call `assertName`, since Grats validates names while
//! extracting them.

use std::ops::{Index, IndexMut};

use indexmap::IndexMap;

use crate::error::graphql_error::GraphQLError;
use crate::js_value::Value;
use crate::jsutils::did_you_mean::did_you_mean;
use crate::jsutils::suggestion_list::suggestion_list;
use crate::language::ast::{
    ConstValueNode, EnumTypeDefinitionNode, EnumTypeExtensionNode, EnumValueDefinitionNode,
    FieldDefinitionNode, InputObjectTypeDefinitionNode, InputObjectTypeExtensionNode,
    InputValueDefinitionNode, InterfaceTypeDefinitionNode, InterfaceTypeExtensionNode,
    ObjectTypeDefinitionNode, ObjectTypeExtensionNode, ScalarTypeDefinitionNode,
    ScalarTypeExtensionNode, UnionTypeDefinitionNode, UnionTypeExtensionNode,
};
use crate::language::printer::print_value;
use crate::r#type::introspection::introspection_types;
use crate::r#type::scalars::specified_scalar_types;

/// Identifies a named type in a `TypeArena`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TypeId(pub(crate) usize);

/// The named types of a schema.
///
/// PORT: graphql-js shares the specified scalars and introspection types
/// between schemas as global objects. Here every arena starts with its own
/// copies at fixed ids, so the constants in `scalars.rs` and
/// `introspection.rs` refer to them in any arena.
#[derive(Debug, Clone)]
pub struct TypeArena<'a> {
    types: Vec<GraphQLNamedType<'a>>,
}

impl<'a> TypeArena<'a> {
    pub(crate) fn new() -> Self {
        let mut types: Vec<GraphQLNamedType<'a>> = Vec::new();
        types.extend(specified_scalar_types().map(GraphQLNamedType::Scalar));
        types.extend(introspection_types());
        TypeArena { types }
    }

    pub(crate) fn push(&mut self, r#type: GraphQLNamedType<'a>) -> TypeId {
        self.types.push(r#type);
        TypeId(self.types.len() - 1)
    }
}

impl<'a> Index<TypeId> for TypeArena<'a> {
    type Output = GraphQLNamedType<'a>;

    fn index(&self, id: TypeId) -> &Self::Output {
        &self.types[id.0]
    }
}

impl IndexMut<TypeId> for TypeArena<'_> {
    fn index_mut(&mut self, id: TypeId) -> &mut Self::Output {
        &mut self.types[id.0]
    }
}

/// These are all of the possible kinds of types.
///
/// PORT: graphql-js models list and non-null types as `GraphQLList` and
/// `GraphQLNonNull` objects wrapping another type.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GraphQLType {
    Named(TypeId),
    List(Box<GraphQLType>),
    NonNull(Box<GraphQLType>),
}

impl GraphQLType {
    pub fn is_list_type(&self) -> bool {
        matches!(self, GraphQLType::List(_))
    }

    pub fn is_non_null_type(&self) -> bool {
        matches!(self, GraphQLType::NonNull(_))
    }

    pub fn get_nullable_type(&self) -> &GraphQLType {
        match self {
            GraphQLType::NonNull(of_type) => of_type,
            r#type => r#type,
        }
    }

    pub fn get_named_type(&self) -> TypeId {
        match self {
            GraphQLType::Named(id) => *id,
            GraphQLType::List(of_type) | GraphQLType::NonNull(of_type) => of_type.get_named_type(),
        }
    }

    /// PORT: Takes the arena which holds the type's named type.
    pub fn is_input_type(&self, arena: &TypeArena) -> bool {
        arena[self.get_named_type()].is_input_type()
    }

    /// PORT: Takes the arena which holds the type's named type.
    pub fn is_output_type(&self, arena: &TypeArena) -> bool {
        arena[self.get_named_type()].is_output_type()
    }

    /// PORT: graphql-js `inspect(type)`, which calls the type's `toString()`.
    pub fn inspect(&self, arena: &TypeArena) -> String {
        match self {
            GraphQLType::Named(id) => arena[*id].name().to_string(),
            GraphQLType::List(of_type) => format!("[{}]", of_type.inspect(arena)),
            GraphQLType::NonNull(of_type) => format!("{}!", of_type.inspect(arena)),
        }
    }
}

/// These named types do not include modifiers like List or NonNull.
#[derive(Debug, Clone)]
pub enum GraphQLNamedType<'a> {
    Scalar(GraphQLScalarType<'a>),
    Object(GraphQLObjectType<'a>),
    Interface(GraphQLInterfaceType<'a>),
    Union(GraphQLUnionType<'a>),
    Enum(GraphQLEnumType<'a>),
    InputObject(GraphQLInputObjectType<'a>),
}

impl<'a> GraphQLNamedType<'a> {
    pub fn name(&self) -> &'a str {
        match self {
            GraphQLNamedType::Scalar(t) => t.name,
            GraphQLNamedType::Object(t) => t.name,
            GraphQLNamedType::Interface(t) => t.name,
            GraphQLNamedType::Union(t) => t.name,
            GraphQLNamedType::Enum(t) => t.name,
            GraphQLNamedType::InputObject(t) => t.name,
        }
    }

    /// PORT: `isInputType` for a named type.
    pub fn is_input_type(&self) -> bool {
        matches!(
            self,
            GraphQLNamedType::Scalar(_)
                | GraphQLNamedType::Enum(_)
                | GraphQLNamedType::InputObject(_)
        )
    }

    /// PORT: `isOutputType` for a named type.
    pub fn is_output_type(&self) -> bool {
        matches!(
            self,
            GraphQLNamedType::Scalar(_)
                | GraphQLNamedType::Object(_)
                | GraphQLNamedType::Interface(_)
                | GraphQLNamedType::Union(_)
                | GraphQLNamedType::Enum(_)
        )
    }

    pub fn is_leaf_type(&self) -> bool {
        matches!(
            self,
            GraphQLNamedType::Scalar(_) | GraphQLNamedType::Enum(_)
        )
    }

    pub fn is_abstract_type(&self) -> bool {
        matches!(
            self,
            GraphQLNamedType::Interface(_) | GraphQLNamedType::Union(_)
        )
    }

    pub fn description(&self) -> Option<&'a str> {
        match self {
            GraphQLNamedType::Scalar(t) => t.description,
            GraphQLNamedType::Object(t) => t.description,
            GraphQLNamedType::Interface(t) => t.description,
            GraphQLNamedType::Union(t) => t.description,
            GraphQLNamedType::Enum(t) => t.description,
            GraphQLNamedType::InputObject(t) => t.description,
        }
    }
}

/// Scalar Type Definition
///
/// PORT: Only `parseLiteral` is modeled, since Grats never executes queries.
/// It returns an error where graphql-js throws one.
#[derive(Debug, Clone)]
pub struct GraphQLScalarType<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub specified_by_url: Option<String>,
    pub(crate) parse_literal: fn(&ConstValueNode) -> Result<Value, GraphQLError>,
    pub ast_node: Option<&'a ScalarTypeDefinitionNode>,
    pub extension_ast_nodes: Vec<&'a ScalarTypeExtensionNode>,
}

impl GraphQLScalarType<'_> {
    pub fn parse_literal(&self, value_node: &ConstValueNode) -> Result<Value, GraphQLError> {
        (self.parse_literal)(value_node)
    }
}

/// Object Type Definition
#[derive(Debug, Clone)]
pub struct GraphQLObjectType<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub(crate) fields: IndexMap<&'a str, GraphQLField<'a>>,
    pub(crate) interfaces: Vec<TypeId>,
    pub ast_node: Option<&'a ObjectTypeDefinitionNode>,
    pub extension_ast_nodes: Vec<&'a ObjectTypeExtensionNode>,
}

impl<'a> GraphQLObjectType<'a> {
    pub fn get_fields(&self) -> &IndexMap<&'a str, GraphQLField<'a>> {
        &self.fields
    }

    pub fn get_interfaces(&self) -> &[TypeId] {
        &self.interfaces
    }
}

#[derive(Debug, Clone)]
pub struct GraphQLField<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub r#type: GraphQLType,
    pub args: Vec<GraphQLArgument<'a>>,
    pub deprecation_reason: Option<String>,
    pub ast_node: Option<&'a FieldDefinitionNode>,
}

#[derive(Debug, Clone)]
pub struct GraphQLArgument<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub r#type: GraphQLType,
    pub default_value: Option<Value>,
    pub deprecation_reason: Option<String>,
    pub ast_node: Option<&'a InputValueDefinitionNode>,
}

pub fn is_required_argument(arg: &GraphQLArgument) -> bool {
    arg.r#type.is_non_null_type() && arg.default_value.is_none()
}

/// Interface Type Definition
#[derive(Debug, Clone)]
pub struct GraphQLInterfaceType<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub(crate) fields: IndexMap<&'a str, GraphQLField<'a>>,
    pub(crate) interfaces: Vec<TypeId>,
    pub ast_node: Option<&'a InterfaceTypeDefinitionNode>,
    pub extension_ast_nodes: Vec<&'a InterfaceTypeExtensionNode>,
}

impl<'a> GraphQLInterfaceType<'a> {
    pub fn get_fields(&self) -> &IndexMap<&'a str, GraphQLField<'a>> {
        &self.fields
    }

    pub fn get_interfaces(&self) -> &[TypeId] {
        &self.interfaces
    }
}

/// Union Type Definition
#[derive(Debug, Clone)]
pub struct GraphQLUnionType<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub(crate) types: Vec<TypeId>,
    pub ast_node: Option<&'a UnionTypeDefinitionNode>,
    pub extension_ast_nodes: Vec<&'a UnionTypeExtensionNode>,
}

impl GraphQLUnionType<'_> {
    pub fn get_types(&self) -> &[TypeId] {
        &self.types
    }
}

/// Enum Type Definition
///
/// PORT: Enum values have no `value`: in enums built from SDL, and in the
/// introspection enums, each value is its name.
#[derive(Debug, Clone)]
pub struct GraphQLEnumType<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub(crate) values: Vec<GraphQLEnumValue<'a>>,
    pub ast_node: Option<&'a EnumTypeDefinitionNode>,
    pub extension_ast_nodes: Vec<&'a EnumTypeExtensionNode>,
}

impl<'a> GraphQLEnumType<'a> {
    pub fn get_values(&self) -> &[GraphQLEnumValue<'a>] {
        &self.values
    }

    pub fn get_value(&self, name: &str) -> Option<&GraphQLEnumValue<'a>> {
        self.values.iter().find(|value| value.name == name)
    }

    /// PORT: Returns an error where graphql-js throws one.
    pub fn parse_literal(&self, value_node: &ConstValueNode) -> Result<Value, GraphQLError> {
        // Note: variables will be resolved to a value before calling this function.
        let ConstValueNode::EnumValue(enum_value_node) = value_node else {
            let value_str = print_value(value_node);
            return Err(GraphQLError::new(
                format!(
                    "Enum \"{}\" cannot represent non-enum value: {value_str}.{}",
                    self.name,
                    did_you_mean_enum_value(self, &value_str)
                ),
                vec![value_node.loc()],
            ));
        };

        let Some(enum_value) = self.get_value(&enum_value_node.value) else {
            let value_str = print_value(value_node);
            return Err(GraphQLError::new(
                format!(
                    "Value \"{value_str}\" does not exist in \"{}\" enum.{}",
                    self.name,
                    did_you_mean_enum_value(self, &value_str)
                ),
                vec![value_node.loc()],
            ));
        };

        Ok(Value::String(enum_value.name.to_string()))
    }
}

fn did_you_mean_enum_value(enum_type: &GraphQLEnumType, unknown_value_str: &str) -> String {
    let all_names = enum_type.get_values().iter().map(|value| value.name);
    let suggested_values = suggestion_list(unknown_value_str, all_names);
    did_you_mean(Some("the enum value"), &suggested_values)
}

/// PORT: graphql-js builds enum values from an object map, `valueMap`, keyed by
/// name. Callers pass it as a vector which may repeat a name, and this keeps
/// the first position with the last value, as an object map would.
pub(crate) fn define_enum_values<'a>(
    value_map: Vec<GraphQLEnumValue<'a>>,
) -> Vec<GraphQLEnumValue<'a>> {
    let mut values: IndexMap<&'a str, GraphQLEnumValue<'a>> = IndexMap::new();
    for value in value_map {
        assert_enum_value_name(value.name);
        values.insert(value.name, value);
    }
    values.into_values().collect()
}

/// PORT: graphql-js also calls `assertName`, but Grats validates names while
/// extracting them.
fn assert_enum_value_name(name: &str) {
    if name == "true" || name == "false" || name == "null" {
        panic!("Enum values cannot be named: {name}");
    }
}

#[derive(Debug, Clone)]
pub struct GraphQLEnumValue<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub deprecation_reason: Option<String>,
    pub ast_node: Option<&'a EnumValueDefinitionNode>,
}

/// Input Object Type Definition
#[derive(Debug, Clone)]
pub struct GraphQLInputObjectType<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub(crate) fields: IndexMap<&'a str, GraphQLInputField<'a>>,
    pub ast_node: Option<&'a InputObjectTypeDefinitionNode>,
    pub extension_ast_nodes: Vec<&'a InputObjectTypeExtensionNode>,
    pub is_one_of: bool,
}

impl<'a> GraphQLInputObjectType<'a> {
    pub fn get_fields(&self) -> &IndexMap<&'a str, GraphQLInputField<'a>> {
        &self.fields
    }
}

#[derive(Debug, Clone)]
pub struct GraphQLInputField<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub r#type: GraphQLType,
    pub default_value: Option<Value>,
    pub deprecation_reason: Option<String>,
    pub ast_node: Option<&'a InputValueDefinitionNode>,
}

pub fn is_required_input_field(field: &GraphQLInputField) -> bool {
    field.r#type.is_non_null_type() && field.default_value.is_none()
}
