use std::cell::RefCell;

use graphql_js::error::graphql_error::GraphQLError;
use graphql_js::language::ast::{DocumentNode, Location};
use graphql_js::language::visitor::visit;
use graphql_js::r#type::definition::GraphQLNamedType;
use graphql_js::r#type::schema::GraphQLSchema;
use graphql_js::utilities::type_info::{TypeInfo, visit_with_type_info};
use graphql_js::validation::rules::values_of_correct_type_rule::values_of_correct_type_rule;
use graphql_js::validation::validation_context::ValidationContext;

use crate::utils::diagnostic_error::{DiagnosticsResult, gql_err, gql_related};
use crate::utils::result::ok_unless_errors;

/// Surprisingly, the GraphQL spec (and therefore graphql-js) does not enforce
/// that the types of arguments passed to directives used within the schema are
/// valid with respect to the directive's schema definition.
///
/// However, we believe that if Grats knows, or can know, something is invalid at
/// build time it should report that as an error at build time rather than waiting
/// for a runtime error.
///
/// Therefore, this validation implements the validation which we believe should be
/// part of the GraphQL spec: Enforcing that for every directive used in the schema,
/// its arguments are valid with respect to the directive's schema definition.
pub fn validate_directive_arguments(
    schema: &GraphQLSchema<'_>,
    ast: &DocumentNode,
) -> DiagnosticsResult<()> {
    let mut errors = Vec::new();
    let type_info = RefCell::new(TypeInfo::new(schema));

    let mut on_error = |error: GraphQLError| {
        // Every validation error should have a location to blame to. If not, this
        // is probably some internal error and we should blow up.
        let Some(&loc) = error.nodes.first() else {
            panic!("{}", error.message);
        };

        let type_info = type_info.borrow();
        let input_types = [
            (type_info.get_input_type(), "Input type defined here"),
            (
                type_info.get_parent_input_type(),
                "Parent input type defined here",
            ),
        ];
        let related = input_types
            .into_iter()
            .filter_map(|(input_type, message)| {
                let definition = input_type_definition(&schema[input_type?.get_named_type()])?;
                Some(gql_related(definition, message))
            })
            .collect();

        // Ideally we could include a related code location of the actual field
        // definition, which might be some field on a deeply nested input type.
        // However, it's not possible for us to do that without having our own
        // implementation of parsing a literal to a specific type.

        // For now we'll settle for just including the directive argument location.

        errors.push(gql_err(loc, error.message, Some(related)));
    };

    visit(
        ast,
        &mut visit_with_type_info(
            &type_info,
            values_of_correct_type_rule(ValidationContext::new(schema, &type_info, &mut on_error)),
        ),
    );

    ok_unless_errors(errors, ())
}

/// The location of an input type's definition, unless it's a scalar.
fn input_type_definition(r#type: &GraphQLNamedType) -> Option<Option<Location>> {
    let ast_loc = match r#type {
        GraphQLNamedType::Scalar(_) => return None,
        GraphQLNamedType::Enum(t) => t.ast_node.map(|n| n.loc),
        GraphQLNamedType::InputObject(t) => t.ast_node.map(|n| n.loc),
        GraphQLNamedType::Object(_)
        | GraphQLNamedType::Interface(_)
        | GraphQLNamedType::Union(_) => unreachable!("Expected an input type"),
    };
    Some(ast_loc.expect("Expected input type to have astNode"))
}
