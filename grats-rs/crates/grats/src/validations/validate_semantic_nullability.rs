use graphql_js::language::ast::{ConstDirectiveNode, FieldDefinitionNode, TypeNode};
use graphql_js::r#type::definition::{GraphQLField, GraphQLNamedType};
use graphql_js::r#type::schema::GraphQLSchema;

use crate::grats_config::GratsConfig;
use crate::public_directives::SEMANTIC_NON_NULL_DIRECTIVE;
use crate::utils::diagnostic_error::{DiagnosticsResult, gql_err, gql_related};
use crate::utils::result::ok_unless_errors;

/// Ensure that all semantically non-nullable fields on an interface are also
/// semantically non-nullable on all implementors.
pub fn validate_semantic_nullability(
    schema: &GraphQLSchema<'_>,
    config: &GratsConfig,
) -> DiagnosticsResult<()> {
    if !config.strict_semantic_nullability {
        return Ok(());
    }
    let mut errors = Vec::new();
    let interfaces = schema
        .get_type_map()
        .values()
        .filter_map(|&id| match &schema[id] {
            GraphQLNamedType::Interface(interface_type) => Some((id, interface_type)),
            _ => None,
        });
    for (interface_id, interface_type) in interfaces {
        let type_implementors = schema.get_possible_types(interface_id);

        // For every field on the interface...
        for interface_field in interface_type.get_fields().values() {
            if let TypeNode::NonNullType(_) = field_ast(interface_field).r#type {
                // Type checking of non-null types is handled by graphql-js. If this field is non-null,
                // then validation has already asserted that all implementors are non-null meaning no
                // "semantic" non-null types can be present.
                continue;
            }

            let Some(interface_semantic_non_null) = find_semantic_non_null(interface_field) else {
                // It's fine for implementors to be more strict, since they are still
                // covariant with the less strict interface.
                continue;
            };

            for &implementor_id in type_implementors {
                let implementor = &schema[implementor_id];
                let GraphQLNamedType::Object(implementor_type) = implementor else {
                    unreachable!("Expected an interface's possible types to be object types.");
                };
                let Some(implementor_field) =
                    implementor_type.get_fields().get(interface_field.name)
                else {
                    panic!(
                        "Expected implementorField to be defined. We expected this to be caught by graphql-js validation. This is a bug in Grats. Please report it."
                    );
                };
                if find_semantic_non_null(implementor_field).is_none() {
                    errors.push(gql_err(
                        interface_semantic_non_null.loc,
                        format!(
                            "Interface field `{}.{}` expects a non-nullable type but `{}.{}` is nullable.",
                            interface_type.name,
                            interface_field.name,
                            implementor.name(),
                            implementor_field.name
                        ),
                        Some(vec![gql_related(
                            field_ast(implementor_field).r#type.loc(),
                            "Related location",
                        )]),
                    ));
                }
            }
        }
    }
    ok_unless_errors(errors, ())
}

fn find_semantic_non_null<'a>(field: &GraphQLField<'a>) -> Option<&'a ConstDirectiveNode> {
    field_ast(field)
        .directives
        .as_ref()?
        .iter()
        .find(|d| d.name.value == SEMANTIC_NON_NULL_DIRECTIVE)
}

fn field_ast<'a>(field: &GraphQLField<'a>) -> &'a FieldDefinitionNode {
    field.ast_node.expect("Expected field to have astNode")
}
