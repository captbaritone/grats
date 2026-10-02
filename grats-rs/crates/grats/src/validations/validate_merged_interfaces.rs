//! Port of `src/validations/validateMergedInterfaces.ts`.

use crate::errors as E;
use crate::name_resolver::{MergedDeclarationKind, NameResolver};
use crate::snapshot_refs::DeclRef;
use crate::utils::diagnostic_error::{Diagnostic, DiagnosticsResult, gql_err, gql_related};

/// Prevent using merged interfaces as GraphQL interfaces.
/// https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces
pub fn validate_merged_interfaces(
    resolver: &dyn NameResolver,
    interfaces: &[DeclRef],
) -> DiagnosticsResult<()> {
    let mut errors: Vec<Diagnostic> = Vec::new();

    for declaration in interfaces {
        let merged_declarations = resolver.merged_declarations(declaration);
        if merged_declarations.len() < 2 {
            continue;
        }

        let other_locations: Vec<_> = merged_declarations
            .iter()
            .filter(|d| {
                d.decl_loc != declaration.decl_loc
                    && (d.kind == MergedDeclarationKind::Interface
                        || d.kind == MergedDeclarationKind::Class)
            })
            .map(|d| gql_related(Some(d.name), "Other declaration"))
            .collect();

        if !other_locations.is_empty() {
            errors.push(gql_err(
                Some(declaration.name),
                E::merged_interfaces(),
                Some(other_locations),
            ));
        }
    }

    if !errors.is_empty() {
        return Err(errors);
    }
    Ok(())
}
