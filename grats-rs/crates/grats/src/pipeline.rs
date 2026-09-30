//! Port of the pipeline in `extractSchemaAndDoc` in `src/lib.ts`.
//!
//! PORT: Only the end of the pipeline has been ported. The TypeScript side runs
//! the rest, then calls `validate` with the document. (A crate's `lib.rs` is
//! its root, so this module can't share the TypeScript file's name.)

use std::collections::HashSet;

use graphql_js::error::graphql_error::GraphQLError;
use graphql_js::language::ast::DocumentNode;
use graphql_js::r#type::schema::GraphQLSchema;
use graphql_js::r#type::validate::validate_schema;
use graphql_js::utilities::build_ast_schema::build_ast_schema;
use graphql_js::validation::validate::validate_sdl;
use serde::Deserialize;

use crate::grats_config::GratsConfig;
use crate::utils::diagnostic_error::{
    DiagnosticsWithoutLocationResult, graphql_error_to_diagnostic,
};
use crate::validations::validate_directive_arguments::validate_directive_arguments;
use crate::validations::validate_semantic_nullability::validate_semantic_nullability;
use crate::validations::validate_some_types_are_defined::validate_some_types_are_defined;
use crate::validations::validate_typenames::validate_typenames;

/// PORT: The input to `validate` from TypeScript, besides the document.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateRequest {
    pub config: GratsConfig,
    /// `snapshot.typesWithTypename`.
    pub types_with_typename: HashSet<String>,
}

/// PORT: The validations which follow `sortSchemaAst` in `extractSchemaAndDoc`.
/// After validating the document, they build their own schema from it.
pub fn validate(
    doc: &DocumentNode,
    request: ValidateRequest,
) -> DiagnosticsWithoutLocationResult<()> {
    let config = &request.config;
    spec_validate_sdl(doc)
        .map(build_ast_schema)
        // Apply the "Type Validation" sub-sections of the specification's
        // "Type System" section.
        .and_then(spec_schema_validation)
        // Provide a helpful getting started error if no types are detected.
        .and_then(validate_some_types_are_defined)
        // Ensure that any custom validations that are not part of the spec
        // are also applied.
        // The above spec validation fails to catch type errors in directive
        // arguments, so Grats checks these manually.
        .and_then(|schema| validate_directive_arguments(schema, doc))
        // Ensure that every type which implements an interface or is a member of a
        // union has a __typename field.
        .and_then(|schema| validate_typenames(schema, &request.types_with_typename))
        // Validate that semantic nullability directives are not in conflict
        // with type nullability.
        .and_then(|schema| validate_semantic_nullability(schema, config))
        .map(|_schema| ())
}

fn spec_validate_sdl(doc: &DocumentNode) -> DiagnosticsWithoutLocationResult<&DocumentNode> {
    // TODO: Currently this does not detect definitions that shadow builtins
    // (`String`, `Int`, etc). However, if we pass a second param (extending an
    // existing schema) we do! So, we should find a way to validate that we don't
    // shadow builtins.
    as_diagnostics(doc, |doc| validate_sdl(doc))
}

fn spec_schema_validation(
    schema: GraphQLSchema<'_>,
) -> DiagnosticsWithoutLocationResult<GraphQLSchema<'_>> {
    as_diagnostics(schema, validate_schema)
}

// Utility to map GraphQL validation errors to a Result of
fn as_diagnostics<T>(
    value: T,
    validate: impl FnOnce(&T) -> Vec<GraphQLError>,
) -> DiagnosticsWithoutLocationResult<T> {
    let validation_errors: Vec<GraphQLError> = validate(&value)
        .into_iter()
        // FIXME: Handle case where query is not defined (no location)
        // PORT: graphql-js errors have a source, locations and positions when
        // one of their nodes has a location.
        .filter(|e| e.nodes.iter().any(Option::is_some))
        .collect();
    if !validation_errors.is_empty() {
        return Err(validation_errors
            .iter()
            .map(graphql_error_to_diagnostic)
            .collect());
    }
    Ok(value)
}
