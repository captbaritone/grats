//! Port of graphql-js `validation/rules/ValuesOfCorrectTypeRule.ts`.
//!
//! PORT: Only constant values are ported (see `ast.rs`), so the rule doesn't
//! track variable definitions, and never finds a variable in a OneOf Input
//! Object.

use indexmap::IndexMap;

use crate::error::graphql_error::GraphQLError;
use crate::jsutils::did_you_mean::did_you_mean;
use crate::jsutils::suggestion_list::suggestion_list;
use crate::language::ast::{ConstObjectFieldNode, ConstValueNode};
use crate::language::printer::print_value;
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::r#type::definition::{
    GraphQLInputObjectType, GraphQLNamedType, GraphQLType, is_required_input_field,
};
use crate::validation::validation_context::ValidationContext;

/// Value literals of correct type
///
/// A GraphQL document is only valid if all value literals are of the type
/// expected at their position.
///
/// See https://spec.graphql.org/draft/#sec-Values-of-Correct-Type
pub fn values_of_correct_type_rule<'c, 's, 'a>(
    context: ValidationContext<'c, 's, 'a>,
) -> ValuesOfCorrectTypeRule<'c, 's, 'a> {
    ValuesOfCorrectTypeRule { context }
}

pub struct ValuesOfCorrectTypeRule<'c, 's, 'a> {
    context: ValidationContext<'c, 's, 'a>,
}

impl<'n> ASTVisitor<'n> for ValuesOfCorrectTypeRule<'_, '_, '_> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        let context = &mut self.context;
        let schema = context.get_schema();
        let named_type = |r#type: &GraphQLType| &schema[r#type.get_named_type()];

        match node {
            ASTNode::ConstValue(node) => match node {
                ConstValueNode::ListValue(_) => {
                    // Note: TypeInfo will traverse into a list's item type, so look to the
                    // parent input type to check if it is a list.
                    let r#type = context
                        .get_parent_input_type()
                        .map(GraphQLType::get_nullable_type);
                    if !r#type.is_some_and(GraphQLType::is_list_type) {
                        is_valid_value_node(context, node);
                        return VisitAction::Skip; // Don't traverse further.
                    }
                }
                ConstValueNode::ObjectValue(object_value) => {
                    let r#type = context.get_input_type().map(named_type);
                    let Some(GraphQLNamedType::InputObject(r#type)) = r#type else {
                        is_valid_value_node(context, node);
                        return VisitAction::Skip; // Don't traverse further.
                    };
                    // Ensure every required field exists.
                    // PORT: `keyMap`, which keeps the last field of each name
                    // at the position of the first.
                    let mut field_node_map: IndexMap<&str, &ConstObjectFieldNode> = IndexMap::new();
                    for field in &object_value.fields {
                        field_node_map.insert(field.name.value.as_str(), field);
                    }
                    for field_def in r#type.get_fields().values() {
                        let field_node = field_node_map.get(field_def.name);
                        if field_node.is_none() && is_required_input_field(field_def) {
                            let type_str = field_def.r#type.inspect(schema.arena());
                            context.report_error(GraphQLError::new(
                                format!(
                                    "Field \"{}.{}\" of required type \"{type_str}\" was not provided.",
                                    r#type.name, field_def.name
                                ),
                                vec![node.loc()],
                            ));
                        }
                    }

                    if r#type.is_one_of {
                        validate_one_of_input_object(context, node, r#type, &field_node_map);
                    }
                }
                ConstValueNode::NullValue(_) => {
                    let r#type = context.get_input_type();
                    if let Some(r#type) = r#type.filter(|t| t.is_non_null_type()) {
                        context.report_error(GraphQLError::new(
                            format!(
                                "Expected value of type \"{}\", found {}.",
                                r#type.inspect(schema.arena()),
                                print_value(node)
                            ),
                            vec![node.loc()],
                        ));
                    }
                }
                ConstValueNode::EnumValue(_)
                | ConstValueNode::IntValue(_)
                | ConstValueNode::FloatValue(_)
                | ConstValueNode::StringValue(_)
                | ConstValueNode::BooleanValue(_) => is_valid_value_node(context, node),
            },
            ASTNode::ObjectField(node) => {
                let parent_type = context.get_parent_input_type().map(named_type);
                let field_type = context.get_input_type();
                if field_type.is_none()
                    && let Some(GraphQLNamedType::InputObject(parent_type)) = parent_type
                {
                    let suggestions =
                        suggestion_list(&node.name.value, parent_type.get_fields().keys().copied());
                    context.report_error(GraphQLError::new(
                        format!(
                            "Field \"{}\" is not defined by type \"{}\".",
                            node.name.value, parent_type.name
                        ) + &did_you_mean(None, &suggestions),
                        vec![node.loc],
                    ));
                }
            }
            // PORT: Descriptions are visited as `StringValue` nodes in
            // graphql-js, but are never in an input position, so
            // `isValidValueNode` would ignore them.
            _ => {}
        }
        VisitAction::Continue
    }
}

/// Any value literal may be a valid representation of a Scalar, depending on
/// that scalar type.
fn is_valid_value_node(context: &mut ValidationContext, node: &ConstValueNode) {
    // Report any error at the full type expected by the location.
    let Some(location_type) = context.get_input_type() else {
        return;
    };

    let schema = context.get_schema();
    let r#type = &schema[location_type.get_named_type()];

    if !r#type.is_leaf_type() {
        let type_str = location_type.inspect(schema.arena());
        context.report_error(GraphQLError::new(
            format!(
                "Expected value of type \"{type_str}\", found {}.",
                print_value(node)
            ),
            vec![node.loc()],
        ));
        return;
    }

    // Scalars and Enums determine if a literal value is valid via parseLiteral(),
    // which may throw or return an invalid value to indicate failure.
    //
    // PORT: The ported `parseLiteral` functions return an error rather than
    // throw, never return an invalid value for constant values, and only
    // return `GraphQLError`s.
    let parse_result = match r#type {
        GraphQLNamedType::Scalar(r#type) => r#type.parse_literal(node),
        GraphQLNamedType::Enum(r#type) => r#type.parse_literal(node),
        _ => unreachable!("Checked that the type is a leaf type"),
    };
    if let Err(error) = parse_result {
        context.report_error(error);
    }
}

/// PORT: Values are constant, so `variableDefinitions` isn't needed.
fn validate_one_of_input_object(
    context: &mut ValidationContext,
    node: &ConstValueNode,
    r#type: &GraphQLInputObjectType,
    field_node_map: &IndexMap<&str, &ConstObjectFieldNode>,
) {
    let keys: Vec<&str> = field_node_map.keys().copied().collect();
    let is_not_exactly_one_field = keys.len() != 1;

    if is_not_exactly_one_field {
        context.report_error(GraphQLError::new(
            format!(
                "OneOf Input Object \"{}\" must specify exactly one key.",
                r#type.name
            ),
            vec![node.loc()],
        ));
        return;
    }

    let value = &field_node_map[keys[0]].value;
    let is_null_literal = matches!(value, ConstValueNode::NullValue(_));

    if is_null_literal {
        context.report_error(GraphQLError::new(
            format!("Field \"{}.{}\" must be non-null.", r#type.name, keys[0]),
            vec![node.loc()],
        ));
    }
}
