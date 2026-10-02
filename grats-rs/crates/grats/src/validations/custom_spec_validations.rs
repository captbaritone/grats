use graphql_js::language::ast::{DefinitionNode, DocumentNode};

use crate::errors as E;
use crate::utils::diagnostic_error::{Diagnostic, DiagnosticsResult, gql_err};
use crate::utils::result::ok_unless_errors;

/// Grats depends upon graphql-js for implementing spec-compliant GraphQL schema
/// validation, but there are some cases where Grats could provide a more helpful
/// error message. This validation pass implements those custom validations messages.
pub fn custom_spec_validations(document_node: DocumentNode) -> DiagnosticsResult<DocumentNode> {
    let errors: Vec<Diagnostic> = document_node
        .definitions
        .iter()
        .filter_map(|def| {
            let (kind, name, fields) = match def {
                DefinitionNode::ObjectTypeDefinition(def) => ("Type", &def.name, &def.fields),
                DefinitionNode::InterfaceTypeDefinition(def) => {
                    ("Interface", &def.name, &def.fields)
                }
                _ => return None,
            };
            fields
                .as_ref()
                .is_none_or(Vec::is_empty)
                .then(|| gql_err(name.loc, E::type_with_no_fields(kind, &name.value), None))
        })
        .collect();
    ok_unless_errors(errors, document_node)
}
