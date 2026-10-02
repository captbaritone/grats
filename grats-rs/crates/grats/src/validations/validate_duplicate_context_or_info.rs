use crate::errors as E;
use crate::type_context::{DeclarationDefinition, DeclarationDefinitionKind};
use crate::utils::diagnostic_error::{Diagnostic, DiagnosticsResult, gql_err, gql_related};
use crate::utils::result::ok_unless_errors;

/// Reports every `@gqlContext` after the first, and every `@gqlInfo` after
/// the first.
pub fn validate_duplicate_context_or_info<'a>(
    definitions: impl IntoIterator<Item = &'a DeclarationDefinition>,
) -> DiagnosticsResult<()> {
    let mut errors: Vec<Diagnostic> = Vec::new();
    let mut ctx_definition: Option<&DeclarationDefinition> = None;
    let mut has_info_definition = false;
    for named_definition in definitions {
        match named_definition.kind {
            DeclarationDefinitionKind::Context => match ctx_definition {
                Some(ctx_definition) => errors.push(gql_err(
                    named_definition.name.loc,
                    E::duplicate_context_tag(),
                    Some(vec![gql_related(
                        ctx_definition.name.loc,
                        "`@gqlContext` previously defined here.",
                    )]),
                )),
                None => ctx_definition = Some(named_definition),
            },
            DeclarationDefinitionKind::Info => {
                if has_info_definition {
                    errors.push(gql_err(
                        named_definition.name.loc,
                        E::user_defined_info_tag(),
                        None,
                    ));
                }
                has_info_definition = true;
            }
            _ => {}
        }
    }
    ok_unless_errors(errors, ())
}
