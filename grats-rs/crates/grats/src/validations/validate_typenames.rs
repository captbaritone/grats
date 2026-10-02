use std::collections::HashSet;

use graphql_js::r#type::definition::GraphQLNamedType;
use graphql_js::r#type::schema::GraphQLSchema;

use crate::errors as E;
use crate::utils::diagnostic_error::{DiagnosticsResult, gql_err, gql_related};
use crate::utils::result::ok_unless_errors;

/// Ensure that every type which implements an interface or is a member of a
/// union has a __typename field.
pub fn validate_typenames(
    schema: &GraphQLSchema<'_>,
    has_typename: &HashSet<String>,
) -> DiagnosticsResult<()> {
    let mut errors = Vec::new();
    let abstract_types = schema
        .get_type_map()
        .values()
        .filter_map(|&id| match &schema[id] {
            // The name in the type's definition.
            GraphQLNamedType::Interface(t) => Some((id, t.name, t.ast_node.map(|n| &n.name), true)),
            GraphQLNamedType::Union(t) => Some((id, t.name, t.ast_node.map(|n| &n.name), false)),
            _ => None,
        });
    for (type_id, type_name, type_ast_name, is_interface) in abstract_types {
        for &implementor_id in schema.get_possible_types(type_id) {
            let GraphQLNamedType::Object(implementor) = &schema[implementor_id] else {
                unreachable!("Expected possible types to be object types.");
            };
            let ast = implementor
                .ast_node
                .expect("Expected object type to have astNode");
            // Synthesized type cannot guarantee that they have the correct __typename field, so we
            // prevent their use in interfaces and unions.
            if ast.was_synthesized {
                let message = if is_interface {
                    E::generic_type_implements_interface()
                } else {
                    E::generic_type_used_as_union_member()
                };
                errors.push(gql_err(ast.name.loc, message, None));
            } else if !has_typename.contains(implementor.name) && ast.exported.is_none() {
                let message = if is_interface {
                    E::concrete_typename_implementing_interface_cannot_be_resolved(
                        implementor.name,
                        type_name,
                    )
                } else {
                    E::concrete_typename_in_union_cannot_be_resolved(implementor.name, type_name)
                };
                let type_ast_name = type_ast_name.expect("Expected abstract type to have astNode");
                errors.push(gql_err(
                    ast.name.loc,
                    message,
                    Some(vec![gql_related(
                        type_ast_name.loc,
                        &format!("{type_name} is defined here:"),
                    )]),
                ));
            }
        }
    }
    ok_unless_errors(errors, ())
}
