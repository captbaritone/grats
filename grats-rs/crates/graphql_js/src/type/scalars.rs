//! Port of graphql-js `type/scalars.ts`.
//!
//! PORT: Only `parseLiteral` is ported (see `GraphQLScalarType`).

use crate::js_value::{Value, parse_float, parse_int};
use crate::language::ast::ConstValueNode;
use crate::r#type::definition::{GraphQLScalarType, TypeId};

/// Maximum possible Int value as per GraphQL Spec (32-bit signed integer).
/// n.b. This differs from JavaScript's numbers that are IEEE 754 doubles safe
/// up-to 2^53 - 1
pub const GRAPHQL_MAX_INT: f64 = 2147483647.0;

/// Minimum possible Int value as per GraphQL Spec (32-bit signed integer).
/// n.b. This differs from JavaScript's numbers that are IEEE 754 doubles safe
/// starting at -(2^53 - 1)
pub const GRAPHQL_MIN_INT: f64 = -2147483648.0;

/// PORT: graphql-js exports the specified scalars as global objects. Here they
/// are the ids at which every `TypeArena` holds them.
pub const GRAPHQL_STRING: TypeId = TypeId(0);
pub const GRAPHQL_INT: TypeId = TypeId(1);
pub const GRAPHQL_FLOAT: TypeId = TypeId(2);
pub const GRAPHQL_BOOLEAN: TypeId = TypeId(3);
pub const GRAPHQL_ID: TypeId = TypeId(4);

fn graphql_int() -> GraphQLScalarType<'static> {
    GraphQLScalarType {
        name: "Int",
        description: Some(
            "The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.",
        ),
        specified_by_url: None,
        parse_literal: |value_node| {
            let ConstValueNode::IntValue(value_node) = value_node else {
                return None;
            };
            let num = parse_int(&value_node.value);
            if num > GRAPHQL_MAX_INT || num < GRAPHQL_MIN_INT {
                return None;
            }
            Some(Value::Number(num))
        },
        ast_node: None,
        extension_ast_nodes: Vec::new(),
    }
}

fn graphql_float() -> GraphQLScalarType<'static> {
    GraphQLScalarType {
        name: "Float",
        description: Some(
            "The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point).",
        ),
        specified_by_url: None,
        parse_literal: |value_node| match value_node {
            ConstValueNode::FloatValue(value_node) => {
                Some(Value::Number(parse_float(&value_node.value)))
            }
            ConstValueNode::IntValue(value_node) => {
                Some(Value::Number(parse_float(&value_node.value)))
            }
            _ => None,
        },
        ast_node: None,
        extension_ast_nodes: Vec::new(),
    }
}

fn graphql_string() -> GraphQLScalarType<'static> {
    GraphQLScalarType {
        name: "String",
        description: Some(
            "The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.",
        ),
        specified_by_url: None,
        parse_literal: |value_node| match value_node {
            ConstValueNode::StringValue(value_node) => {
                Some(Value::String(value_node.value.clone()))
            }
            _ => None,
        },
        ast_node: None,
        extension_ast_nodes: Vec::new(),
    }
}

fn graphql_boolean() -> GraphQLScalarType<'static> {
    GraphQLScalarType {
        name: "Boolean",
        description: Some("The `Boolean` scalar type represents `true` or `false`."),
        specified_by_url: None,
        parse_literal: |value_node| match value_node {
            ConstValueNode::BooleanValue(value_node) => Some(Value::Boolean(value_node.value)),
            _ => None,
        },
        ast_node: None,
        extension_ast_nodes: Vec::new(),
    }
}

fn graphql_id() -> GraphQLScalarType<'static> {
    GraphQLScalarType {
        name: "ID",
        description: Some(
            "The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `\"4\"`) or integer (such as `4`) input value will be accepted as an ID.",
        ),
        specified_by_url: None,
        parse_literal: |value_node| match value_node {
            ConstValueNode::StringValue(value_node) => {
                Some(Value::String(value_node.value.clone()))
            }
            ConstValueNode::IntValue(value_node) => Some(Value::String(value_node.value.clone())),
            _ => None,
        },
        ast_node: None,
        extension_ast_nodes: Vec::new(),
    }
}

/// PORT: The ids of these types are `SPECIFIED_SCALAR_TYPES`, in the same
/// order.
pub fn specified_scalar_types() -> [GraphQLScalarType<'static>; 5] {
    [
        graphql_string(),
        graphql_int(),
        graphql_float(),
        graphql_boolean(),
        graphql_id(),
    ]
}

pub const SPECIFIED_SCALAR_TYPES: [TypeId; 5] = [
    GRAPHQL_STRING,
    GRAPHQL_INT,
    GRAPHQL_FLOAT,
    GRAPHQL_BOOLEAN,
    GRAPHQL_ID,
];

/// PORT: graphql-js compares the type's name against the specified scalars'
/// names. A schema always holds the specified scalars at their own ids, and
/// resolves their names to them, so comparing ids is equivalent.
pub fn is_specified_scalar_type(r#type: TypeId) -> bool {
    SPECIFIED_SCALAR_TYPES.contains(&r#type)
}
