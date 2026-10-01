//! Port of `src/validations/validateDirectiveArguments.ts`.

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
use crate::utils::helpers::null_throws;

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

    {
        let type_info = RefCell::new(TypeInfo::new(schema));

        let mut on_error = |error: GraphQLError| {
            if error.nodes.is_empty() {
                // Every validation error should have a location to blame to. If not, this
                // is probably some internal error and we should blow up.
                panic!("{}", error.message);
            }

            let type_info = type_info.borrow();
            let mut related = Vec::new();
            let input_type = type_info.get_input_type();
            if let Some(input_type) = input_type {
                let input_named_type = &schema[input_type.get_named_type()];
                if !matches!(input_named_type, GraphQLNamedType::Scalar(_)) {
                    let input_type_ast = null_throws(ast_node_loc(input_named_type));
                    related.push(gql_related(input_type_ast, "Input type defined here"));
                }
            }

            let parent_type = type_info.get_parent_input_type();
            if let Some(parent_type) = parent_type {
                let parent_named_type = &schema[parent_type.get_named_type()];
                if !matches!(parent_named_type, GraphQLNamedType::Scalar(_)) {
                    let parent_type_ast = null_throws(ast_node_loc(parent_named_type));
                    related.push(gql_related(
                        parent_type_ast,
                        "Parent input type defined here",
                    ));
                }
            }

            // PORT: The TypeScript implementation also relates the location of
            // `typeInfo.getFieldDef()`, "Directive argument defined here".
            // `TypeInfo` only tracks a field definition within the fields of
            // executable documents, so it is always `undefined` here.

            // Ideally we could include a related code location of the actual field
            // definition, which might be some field on a deeply nested input type.
            // However, it's not possible for us to do that without having our own
            // implementation of parsing a literal to a specific type.

            // For now we'll settle for just including the directive argument location.

            errors.push(gql_err(error.nodes[0], error.message, Some(related)));
        };

        let visitor =
            values_of_correct_type_rule(ValidationContext::new(schema, &type_info, &mut on_error));

        visit(ast, &mut visit_with_type_info(&type_info, visitor));
    }

    if !errors.is_empty() {
        return Err(errors);
    }
    Ok(())
}

/// PORT: The location of `namedType.astNode`, which every named type class
/// has, or `None` if it has no AST node.
fn ast_node_loc(r#type: &GraphQLNamedType) -> Option<Option<Location>> {
    match r#type {
        GraphQLNamedType::Scalar(t) => t.ast_node.map(|n| n.loc),
        GraphQLNamedType::Object(t) => t.ast_node.map(|n| n.loc),
        GraphQLNamedType::Interface(t) => t.ast_node.map(|n| n.loc),
        GraphQLNamedType::Union(t) => t.ast_node.map(|n| n.loc),
        GraphQLNamedType::Enum(t) => t.ast_node.map(|n| n.loc),
        GraphQLNamedType::InputObject(t) => t.ast_node.map(|n| n.loc),
    }
}
