use crate::errors as E;
use crate::name_resolver::{MergedDeclarationKind, NameResolver};
use crate::snapshot_refs::DeclRef;
use crate::utils::diagnostic_error::{Diagnostic, DiagnosticsResult, gql_err, gql_related};
use crate::utils::result::ok_unless_errors;

/// Prevent using merged interfaces as GraphQL interfaces.
/// https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces
pub fn validate_merged_interfaces(
    resolver: &dyn NameResolver,
    interfaces: &[DeclRef],
) -> DiagnosticsResult<()> {
    let errors: Vec<Diagnostic> = interfaces
        .iter()
        .filter_map(|declaration| {
            let other_locations: Vec<_> = resolver
                .merged_declarations(declaration)
                .iter()
                .filter(|d| {
                    d.decl_loc != declaration.decl_loc
                        && matches!(
                            d.kind,
                            MergedDeclarationKind::Interface | MergedDeclarationKind::Class
                        )
                })
                .map(|d| gql_related(Some(d.name), "Other declaration"))
                .collect();
            (!other_locations.is_empty()).then(|| {
                gql_err(
                    Some(declaration.name),
                    E::merged_interfaces(),
                    Some(other_locations),
                )
            })
        })
        .collect();
    ok_unless_errors(errors, ())
}
