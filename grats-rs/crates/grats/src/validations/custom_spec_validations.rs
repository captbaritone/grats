//! Port of `src/validations/customSpecValidations.ts`.

use graphql_js::language::ast::{DefinitionNode, DocumentNode};

use crate::errors as E;
use crate::utils::diagnostic_error::{Diagnostic, DiagnosticsResult, gql_err};

/// Grats depends upon graphql-js for implementing spec-compliant GraphQL schema
/// validation, but there are some cases where Grats could provide a more helpful
/// error message. This validation pass implements those custom validations messages.
pub fn custom_spec_validations(document_node: DocumentNode) -> DiagnosticsResult<DocumentNode> {
    let mut errors: Vec<Diagnostic> = Vec::new();
    for def in &document_node.definitions {
        match def {
            DefinitionNode::ObjectTypeDefinition(def)
                if def.fields.as_ref().is_none_or(Vec::is_empty) =>
            {
                errors.push(gql_err(
                    def.name.loc,
                    E::type_with_no_fields("Type", &def.name.value),
                    None,
                ));
            }
            DefinitionNode::InterfaceTypeDefinition(def)
                if def.fields.as_ref().is_none_or(Vec::is_empty) =>
            {
                errors.push(gql_err(
                    def.name.loc,
                    E::type_with_no_fields("Interface", &def.name.value),
                    None,
                ));
            }
            _ => {}
        }
    }
    if !errors.is_empty() {
        return Err(errors);
    }
    Ok(document_node)
}
