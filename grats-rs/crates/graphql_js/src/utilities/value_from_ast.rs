//! Port of graphql-js `utilities/valueFromAST.ts`.
//!
//! PORT: Only constant values are ported, since Grats never handles variables.

use std::collections::HashMap;

use indexmap::IndexMap;

use crate::js_value::Value;
use crate::language::ast::{ConstObjectFieldNode, ConstValueNode};
use crate::r#type::definition::{GraphQLNamedType, GraphQLType, TypeArena};

/// Produces a JavaScript value given a GraphQL Value AST.
///
/// A GraphQL type must be provided, which will be used to interpret different
/// GraphQL Value literals.
///
/// Returns `None` when the value could not be validly coerced according to
/// the provided type.
///
/// | GraphQL Value        | JSON Value    |
/// | -------------------- | ------------- |
/// | Input Object         | Object        |
/// | List                 | Array         |
/// | Boolean              | Boolean       |
/// | String               | String        |
/// | Int / Float          | Number        |
/// | Enum Value           | Unknown       |
/// | NullValue            | null          |
pub fn value_from_ast(
    value_node: Option<&ConstValueNode>,
    r#type: &GraphQLType,
    arena: &TypeArena,
) -> Option<Value> {
    // When there is no node, then there is also no value.
    // Importantly, this is different from returning the value null.
    let value_node = value_node?;

    if let GraphQLType::NonNull(of_type) = r#type {
        if let ConstValueNode::NullValue(_) = value_node {
            return None; // Invalid: intentionally return no value.
        }
        return value_from_ast(Some(value_node), of_type, arena);
    }

    if let ConstValueNode::NullValue(_) = value_node {
        // This is explicitly returning the value null.
        return Some(Value::Null);
    }

    let named_type = match r#type {
        GraphQLType::List(item_type) => {
            if let ConstValueNode::ListValue(value_node) = value_node {
                let mut coerced_values = Vec::new();
                for item_node in &value_node.values {
                    // Invalid: intentionally return no value.
                    let item_value = value_from_ast(Some(item_node), item_type, arena)?;
                    coerced_values.push(item_value);
                }
                return Some(Value::List(coerced_values));
            }

            // Invalid: intentionally return no value.
            let coerced_value = value_from_ast(Some(value_node), item_type, arena)?;
            return Some(Value::List(vec![coerced_value]));
        }
        GraphQLType::Named(id) => &arena[*id],
        GraphQLType::NonNull(_) => unreachable!("Handled above"),
    };

    match named_type {
        GraphQLNamedType::InputObject(r#type) => {
            let ConstValueNode::ObjectValue(value_node) = value_node else {
                return None; // Invalid: intentionally return no value.
            };

            let mut coerced_obj = IndexMap::new();
            // keyMap
            let field_nodes: HashMap<&str, &ConstObjectFieldNode> = value_node
                .fields
                .iter()
                .map(|field| (field.name.value.as_str(), field))
                .collect();

            for field in r#type.get_fields().values() {
                let Some(field_node) = field_nodes.get(field.name) else {
                    if let Some(default_value) = &field.default_value {
                        coerced_obj.insert(field.name.to_string(), default_value.clone());
                    } else if field.r#type.is_non_null_type() {
                        return None; // Invalid: intentionally return no value.
                    }
                    continue;
                };

                // Invalid: intentionally return no value.
                let field_value = value_from_ast(Some(&field_node.value), &field.r#type, arena)?;
                coerced_obj.insert(field.name.to_string(), field_value);
            }

            if r#type.is_one_of {
                if coerced_obj.len() != 1 {
                    return None; // Invalid: not exactly one key, intentionally return no value.
                }

                if coerced_obj[0] == Value::Null {
                    return None; // Invalid: value not non-null, intentionally return no value.
                }
            }

            Some(Value::Object(coerced_obj))
        }
        // Scalars and Enums fulfill parsing a literal value via parseLiteral().
        // Invalid values represent a failure to parse correctly, in which case
        // no value is returned.
        GraphQLNamedType::Scalar(r#type) => r#type.parse_literal(value_node),
        GraphQLNamedType::Enum(r#type) => r#type.parse_literal(value_node),
        // Not reachable, all possible input types have been considered.
        GraphQLNamedType::Object(_)
        | GraphQLNamedType::Interface(_)
        | GraphQLNamedType::Union(_) => {
            panic!("Unexpected input type: {}", named_type.name())
        }
    }
}
