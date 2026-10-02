use graphql_js::language::ast::{DefinitionNode, DocumentNode, FieldDefinitionNode, TypeNode};

use crate::errors as E;
use crate::graphql_constructor::nullable_type;
use crate::grats_config::GratsConfig;
use crate::public_directives::{add_semantic_non_null_directive, make_semantic_non_null_directive};
use crate::utils::diagnostic_error::{Diagnostic, DiagnosticsResult, gql_err};
use crate::utils::result::ok_unless_errors;

/// Grats has options to make all fields nullable by default to conform to
/// GraphQL best practices. This transform applies this option to the schema.
pub fn apply_default_nullability(
    mut doc: DocumentNode,
    config: &GratsConfig,
) -> DiagnosticsResult<DocumentNode> {
    let mut errors: Vec<Diagnostic> = Vec::new();
    for definition in &mut doc.definitions {
        let fields = match definition {
            DefinitionNode::ObjectTypeDefinition(t) => &mut t.fields,
            DefinitionNode::ObjectTypeExtension(t) => &mut t.fields,
            DefinitionNode::InterfaceTypeDefinition(t) => &mut t.fields,
            DefinitionNode::InterfaceTypeExtension(t) => &mut t.fields,
            _ => continue,
        };
        for t in fields.iter_mut().flatten() {
            visit_field_definition(t, config, &mut errors);
        }
    }
    ok_unless_errors(errors, ())?;
    if config.strict_semantic_nullability {
        doc.definitions = add_semantic_non_null_directive(doc.definitions);
    }
    Ok(doc)
}

fn visit_field_definition(
    t: &mut FieldDefinitionNode,
    &GratsConfig {
        nullable_by_default,
        strict_semantic_nullability,
        ..
    }: &GratsConfig,
    errors: &mut Vec<Diagnostic>,
) {
    if let Some(kills_parent) = &t.kills_parent_on_exception {
        // You can only use @killsParentOnException if nullableByDefault is on.
        if !nullable_by_default {
            errors.push(gql_err(
                kills_parent.loc,
                E::kills_parent_on_exception_with_wrong_config(),
                None,
            ));
        }
        // You can't use @killsParentOnException if it's been typed as nullable
        if !matches!(t.r#type, TypeNode::NonNullType(_)) {
            errors.push(gql_err(
                kills_parent.loc,
                E::kills_parent_on_exception_on_nullable(),
                None,
            ));
        }
        // Set the location of the NON_NULL_TYPE wrapper to the location of the
        // `@killsParentOnException` directive so that type errors created by graphql-js
        // are reported at the correct location.
        let loc = kills_parent.loc;
        match &mut t.r#type {
            TypeNode::NamedType(t) => t.loc = loc,
            TypeNode::ListType(t) => t.loc = loc,
            TypeNode::NonNullType(t) => t.loc = loc,
        }
        return;
    }
    if nullable_by_default && matches!(t.r#type, TypeNode::NonNullType(_)) {
        let type_loc = t.r#type.loc();
        let directives = t.directives.get_or_insert_default();
        if strict_semantic_nullability {
            let type_loc = type_loc.expect("Expected type to have loc");
            directives.push(make_semantic_non_null_directive(type_loc));
        }
        t.r#type = nullable_type(t.r#type.clone()).into();
    }
}
