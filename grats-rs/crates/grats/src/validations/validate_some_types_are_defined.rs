use graphql_js::language::ast::{DefinitionNode, DocumentNode, Location};

use crate::codegen::schema_codegen::BUILT_IN_SCALARS;
use crate::errors as E;
use crate::public_directives::SEMANTIC_NON_NULL_DIRECTIVE;
use crate::utils::diagnostic_error::{DiagnosticsResult, located_err};

/// We want to support a "getting started" experience where users can run `npx
/// grats` and let the error messages guide them to getting something working.
///
/// So, even though an empty schema is technically valid, we treat it as an error
/// so we can provide the user with a helpful message teaching them about defining
/// types.
///
/// The error is reported at `loc`: the part of the project's config which
/// chooses the files Grats read, since that's the other way to fix it. It's a
/// closure because finding it means reading the config, which is only worth
/// doing for a project which turns out to have no types.
pub fn validate_some_types_are_defined(
    doc: &DocumentNode,
    loc: &dyn Fn() -> Option<Location>,
) -> DiagnosticsResult<()> {
    if doc.definitions.iter().any(is_user_defined) {
        Ok(())
    } else {
        Err(vec![located_err(loc(), E::no_types_defined())])
    }
}

/// Whether the definition is the user's, rather than one Grats adds, like the
/// `@semanticNonNull` directive `strictSemanticNullability` adds. Built-in
/// scalars, which Grats' own `Types.ts` declares, don't count either.
fn is_user_defined(definition: &DefinitionNode) -> bool {
    match definition {
        DefinitionNode::DirectiveDefinition(directive) => {
            directive.name.value != SEMANTIC_NON_NULL_DIRECTIVE
        }
        DefinitionNode::ScalarTypeDefinition(scalar) => {
            !BUILT_IN_SCALARS.contains(&scalar.name.value.as_str())
        }
        _ => true,
    }
}
