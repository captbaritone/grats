//! Port of graphql-js `execution/values.ts`.
//!
//! PORT: Only `getArgumentValues` and `getDirectiveValues` are ported, for
//! directives in type system definitions: Grats never handles variables or
//! executable documents. Where graphql-js throws a `GraphQLError`, this panics
//! with its message.

use std::collections::HashMap;

use indexmap::IndexMap;

use crate::js_value::Value;
use crate::language::ast::{ConstArgumentNode, ConstDirectiveNode, ConstValueNode};
use crate::language::printer::print_value;
use crate::r#type::definition::TypeArena;
use crate::r#type::directives::GraphQLDirective;
use crate::utilities::value_from_ast::value_from_ast;

/// Prepares an object map of argument values given a list of argument
/// definitions and list of argument AST nodes.
///
/// PORT: graphql-js also accepts a field definition and field node.
pub fn get_argument_values<'d>(
    def: &GraphQLDirective<'d>,
    node: &ConstDirectiveNode,
    arena: &TypeArena,
) -> IndexMap<&'d str, Value> {
    let mut coerced_values = IndexMap::new();

    let argument_nodes = node.arguments.as_deref().unwrap_or_default();
    // keyMap
    let arg_node_map: HashMap<&str, &ConstArgumentNode> = argument_nodes
        .iter()
        .map(|arg| (arg.name.value.as_str(), arg))
        .collect();

    for arg_def in &def.args {
        let name = arg_def.name;
        let arg_type = &arg_def.r#type;
        let Some(argument_node) = arg_node_map.get(name) else {
            if let Some(default_value) = &arg_def.default_value {
                coerced_values.insert(name, default_value.clone());
            } else if arg_type.is_non_null_type() {
                panic!(
                    "Argument \"{name}\" of required type \"{}\" was not provided.",
                    arg_type.inspect(arena)
                );
            }
            continue;
        };

        let value_node = &argument_node.value;
        let is_null = matches!(value_node, ConstValueNode::NullValue(_));

        if is_null && arg_type.is_non_null_type() {
            panic!(
                "Argument \"{name}\" of non-null type \"{}\" must not be null.",
                arg_type.inspect(arena)
            );
        }

        let Some(coerced_value) = value_from_ast(Some(value_node), arg_type, arena) else {
            // Note: ValuesOfCorrectTypeRule validation should catch this before
            // execution. This is a runtime check to ensure execution does not
            // continue with an invalid argument value.
            panic!(
                "Argument \"{name}\" has invalid value {}.",
                print_value(value_node)
            );
        };

        coerced_values.insert(name, coerced_value);
    }

    coerced_values
}

/// Prepares an object map of argument values given a directive definition
/// and a AST node which may contain directives.
///
/// If the directive does not exist on the node, returns `None`.
///
/// PORT: graphql-js accepts the node itself and reads its `directives`.
pub fn get_directive_values<'d>(
    directive_def: &GraphQLDirective<'d>,
    directives: Option<&[ConstDirectiveNode]>,
    arena: &TypeArena,
) -> Option<IndexMap<&'d str, Value>> {
    let directive_node = directives?
        .iter()
        .find(|directive| directive.name.value == directive_def.name)?;
    Some(get_argument_values(directive_def, directive_node, arena))
}
