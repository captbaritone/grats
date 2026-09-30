//! Port of graphql-js `utilities/valueFromASTUntyped.ts`.
//!
//! PORT: Only constant values are ported, since Grats never handles variables.

use indexmap::IndexMap;

use crate::js_value::{Value, parse_float, parse_int};
use crate::language::ast::ConstValueNode;

/// Produces a JavaScript value given a GraphQL Value AST.
///
/// Unlike `valueFromAST()`, no type is provided. The resulting JavaScript value
/// will reflect the provided GraphQL value AST.
///
/// | GraphQL Value        | JavaScript Value |
/// | -------------------- | ---------------- |
/// | Input Object         | Object           |
/// | List                 | Array            |
/// | Boolean              | Boolean          |
/// | String / Enum        | String           |
/// | Int / Float          | Number           |
/// | Null                 | null             |
pub fn value_from_ast_untyped(value_node: &ConstValueNode) -> Value {
    match value_node {
        ConstValueNode::NullValue(_) => Value::Null,
        ConstValueNode::IntValue(node) => Value::Number(parse_int(&node.value)),
        ConstValueNode::FloatValue(node) => Value::Number(parse_float(&node.value)),
        ConstValueNode::StringValue(node) => Value::String(node.value.clone()),
        ConstValueNode::EnumValue(node) => Value::String(node.value.clone()),
        ConstValueNode::BooleanValue(node) => Value::Boolean(node.value),
        ConstValueNode::ListValue(node) => {
            Value::List(node.values.iter().map(value_from_ast_untyped).collect())
        }
        ConstValueNode::ObjectValue(node) => {
            // keyValMap
            let mut map = IndexMap::new();
            for field in &node.fields {
                map.insert(
                    field.name.value.clone(),
                    value_from_ast_untyped(&field.value),
                );
            }
            Value::Object(map)
        }
    }
}
