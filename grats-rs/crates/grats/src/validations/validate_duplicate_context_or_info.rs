//! Port of `src/validations/validateDuplicateContextOrInfo.ts`.

use crate::errors as E;
use crate::type_context::{DeclarationDefinition, DeclarationDefinitionKind};
use crate::utils::diagnostic_error::{Diagnostic, DiagnosticsResult, gql_err, gql_related};

pub fn validate_duplicate_context_or_info<'a>(
    definitions: impl IntoIterator<Item = &'a DeclarationDefinition>,
) -> DiagnosticsResult<()> {
    let mut errors: Vec<Diagnostic> = Vec::new();
    let mut info_definition: Option<&DeclarationDefinition> = None;
    let mut ctx_definition: Option<&DeclarationDefinition> = None;
    for named_definition in definitions {
        match named_definition.kind {
            DeclarationDefinitionKind::Context => {
                if let Some(ctx_definition) = ctx_definition {
                    errors.push(gql_err(
                        named_definition.name.loc,
                        E::duplicate_context_tag(),
                        Some(vec![gql_related(
                            ctx_definition.name.loc,
                            "`@gqlContext` previously defined here.",
                        )]),
                    ));
                    continue;
                }
                ctx_definition = Some(named_definition);
            }
            DeclarationDefinitionKind::Info => {
                if info_definition.is_some() {
                    errors.push(gql_err(
                        named_definition.name.loc,
                        E::user_defined_info_tag(),
                        None,
                    ));
                    continue;
                }
                info_definition = Some(named_definition);
            }
            _ => {}
        }
    }
    if !errors.is_empty() {
        return Err(errors);
    }
    Ok(())
}
