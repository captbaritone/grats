//! Port of `src/validations/validateTypenames.ts`.

use std::collections::HashSet;

use graphql_js::r#type::definition::GraphQLNamedType;
use graphql_js::r#type::schema::GraphQLSchema;

use crate::errors as E;
use crate::utils::diagnostic_error::{DiagnosticsResult, gql_err, gql_related};
use crate::utils::helpers::null_throws;

/// Ensure that every type which implements an interface or is a member of a
/// union has a __typename field.
pub fn validate_typenames(
    schema: &GraphQLSchema<'_>,
    has_typename: &HashSet<String>,
) -> DiagnosticsResult<()> {
    let mut errors = Vec::new();
    // PORT: Each abstract type with the name node of its AST node.
    let abstract_types = schema
        .get_type_map()
        .values()
        .filter_map(|&id| match &schema[id] {
            GraphQLNamedType::Interface(t) => Some((id, t.name, t.ast_node.map(|n| &n.name))),
            GraphQLNamedType::Union(t) => Some((id, t.name, t.ast_node.map(|n| &n.name))),
            _ => None,
        });
    for (type_id, type_name, type_ast_name) in abstract_types {
        let is_interface = matches!(schema[type_id], GraphQLNamedType::Interface(_));
        let type_implementors = schema.get_possible_types(type_id);
        for &implementor_id in type_implementors {
            // PORT: Possible types are object types.
            let GraphQLNamedType::Object(implementor) = &schema[implementor_id] else {
                unreachable!("Expected possible types to be object types.");
            };
            let ast = null_throws(implementor.ast_node);
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

                let err = gql_err(
                    ast.name.loc,
                    message,
                    Some(vec![gql_related(
                        null_throws(type_ast_name).loc,
                        &format!("{type_name} is defined here:"),
                    )]),
                );
                errors.push(err);
            }
        }
    }
    if !errors.is_empty() {
        return Err(errors);
    }
    Ok(())
}
