//! Port of the pipeline in `extractSchemaAndDoc` in `src/lib.ts`.
//!
//! PORT: Only the end of the pipeline has been ported. The TypeScript side runs
//! the rest, then calls `run` with the document. (A crate's `lib.rs` is
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
use crate::transforms::add_implicit_root_types::add_implicit_root_types;
use crate::transforms::add_interface_fields::add_interface_fields;
use crate::transforms::apply_default_nullability::apply_default_nullability;
use crate::transforms::merge_extensions::merge_extensions;
use crate::transforms::sort_schema_ast::sort_schema_ast;
use crate::type_context::{TypeContext, TypeContextState};
use crate::utils::diagnostic_error::{
    DiagnosticsWithoutLocationResult, graphql_error_to_diagnostic,
};
use crate::validations::custom_spec_validations::custom_spec_validations;
use crate::validations::validate_async_iterable::validate_async_iterable;
use crate::validations::validate_directive_arguments::validate_directive_arguments;
use crate::validations::validate_semantic_nullability::validate_semantic_nullability;
use crate::validations::validate_some_types_are_defined::validate_some_types_are_defined;
use crate::validations::validate_typenames::validate_typenames;

/// PORT: The input to `run` from TypeScript, besides the document.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineRequest {
    pub config: GratsConfig,
    /// `snapshot.typesWithTypename`.
    pub types_with_typename: HashSet<String>,
    /// `DIRECTIVES_AST` from `src/publicDirectives.ts`. PORT: It's parsed from
    /// GraphQL text, so it's parsed on the TypeScript side until Rust can parse
    /// GraphQL.
    pub directives_ast: DocumentNode,
    /// PORT: `ctx`, built on the TypeScript side until
    /// `TypeContext.fromSnapshot` is ported.
    pub type_context: TypeContextState,
}

/// PORT: The part of `extractSchemaAndDoc` which starts after
/// `coerceDefaultEnumValues`, with the definitions converted into a
/// `DocumentNode` to cross into Rust. After validating the transformed document, it builds its own schema from
/// it. Returns the transformed document.
pub fn run(
    doc: DocumentNode,
    request: PipelineRequest,
) -> DiagnosticsWithoutLocationResult<DocumentNode> {
    let PipelineRequest {
        config,
        types_with_typename,
        directives_ast,
        type_context,
    } = request;
    let ctx = TypeContext::from_state(type_context);
    // If you define a field on an interface using the functional style, we
    // need to add that field to each concrete type as well. This must be
    // done after all types are created, but before we validate the schema.
    let doc = add_interface_fields(&ctx, doc.definitions)
        // Convert the definitions into a DocumentNode
        .map(|definitions| DocumentNode {
            loc: None,
            definitions,
            token_count: None,
        })
        // Ensure all subscription fields return an AsyncIterable.
        .and_then(validate_async_iterable)
        // Apply default nullability to fields and arguments, and detect any misuse of
        // `@killsParentOnException`.
        .and_then(|doc| apply_default_nullability(doc, &config, directives_ast))
        // Ensure we have Query/Mutation/Subscription types if they've been extended with
        // `@gqlQueryField` and friends.
        .map(add_implicit_root_types)
        // Merge any `extend` definitions into their base definitions.
        .map(merge_extensions)
        // Perform custom validations that reimplement spec validation rules
        // with more tailored error messages.
        .and_then(custom_spec_validations)
        // Sort the definitions in the document to ensure a stable output.
        .map(sort_schema_ast)?;

    spec_validate_sdl(&doc)
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
        .and_then(|schema| validate_directive_arguments(schema, &doc))
        // Ensure that every type which implements an interface or is a member of a
        // union has a __typename field.
        .and_then(|schema| validate_typenames(schema, &types_with_typename))
        // Validate that semantic nullability directives are not in conflict
        // with type nullability.
        .and_then(|schema| validate_semantic_nullability(schema, &config))?;
    Ok(doc)
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
