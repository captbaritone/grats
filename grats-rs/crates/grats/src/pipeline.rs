//! Port of the pipeline in `extractSchemaAndDoc` in `src/lib.ts`.
//!
//! PORT: The TypeScript side parses `tsconfig.json`, then calls `run` with
//! the options which decide the files of the program (see `crate::program`).
//! (A crate's `lib.rs` is its root, so this module can't share the TypeScript
//! file's name.)

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use graphql_js::error::graphql_error::GraphQLError;
use graphql_js::language::ast::DocumentNode;
use graphql_js::r#type::schema::GraphQLSchema;
use graphql_js::r#type::validate::validate_schema;
use graphql_js::utilities::build_ast_schema::build_ast_schema;
use graphql_js::validation::validate::validate_sdl;
use serde::Deserialize;

use crate::extractor::{ExtractionSnapshot, extract};
use crate::files::Files;
use crate::grats_config::GratsConfig;
use crate::host::Host;
use crate::oxc_name_resolver::OxcNameResolver;
use crate::program::{Program, ProgramOptions};
use crate::source_table::SourceTable;
use crate::transforms::add_implicit_root_types::add_implicit_root_types;
use crate::transforms::add_interface_fields::add_interface_fields;
use crate::transforms::apply_default_nullability::apply_default_nullability;
use crate::transforms::coerce_default_enum_values::coerce_default_enum_values;
use crate::transforms::filter_non_gql_interfaces::filter_non_gql_interfaces;
use crate::transforms::merge_extensions::merge_extensions;
use crate::transforms::resolve_resolver_params::resolve_resolver_params;
use crate::transforms::resolve_types::resolve_types;
use crate::transforms::sort_schema_ast::sort_schema_ast;
use crate::type_context::TypeContext;
use crate::utils::diagnostic_error::{
    Diagnostic, DiagnosticsWithoutLocationResult, TsLocatableNode, graphql_error_to_diagnostic,
    ts_err,
};
use crate::utils::result::{collect_results, concat_results};
use crate::validations::custom_spec_validations::custom_spec_validations;
use crate::validations::validate_async_iterable::validate_async_iterable;
use crate::validations::validate_directive_arguments::validate_directive_arguments;
use crate::validations::validate_duplicate_context_or_info::validate_duplicate_context_or_info;
use crate::validations::validate_merged_interfaces::validate_merged_interfaces;
use crate::validations::validate_semantic_nullability::validate_semantic_nullability;
use crate::validations::validate_some_types_are_defined::validate_some_types_are_defined;
use crate::validations::validate_typenames::validate_typenames;

/// PORT: The input to `run` from TypeScript.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineRequest {
    pub config: GratsConfig,
    /// The absolute path of `src/gratsRoot.ts`'s root. See `src/grats_root.rs`.
    pub grats_root: String,
    /// The options which decide the files of the program.
    pub program: ProgramOptions,
}

/// PORT: `extractSchemaAndDoc`, starting from the files of the program
/// (`ts.createProgram`). After validating the transformed document, it builds
/// its own schema from it. Returns the transformed document.
pub fn run(
    request: PipelineRequest,
    host: Arc<dyn Host>,
    sources: &SourceTable,
) -> DiagnosticsWithoutLocationResult<DocumentNode> {
    let PipelineRequest {
        config,
        grats_root,
        program: program_options,
    } = request;
    let allocator = oxc_allocator::Allocator::default();
    let files = Files::new(
        &allocator,
        &*host,
        sources,
        program_options.use_case_sensitive_file_names,
    );
    let program = Program::new(&files, Arc::clone(&host), program_options);
    let resolver = &OxcNameResolver::new(&files, &program);

    let source_files = program.grats_source_files();
    // Syntax errors will prevent us from extracting any GraphQL definitions.
    // PORT: The TypeScript side reported the first of TypeScript's syntax
    // errors in each file. oxc's wording differs, and its parser also reports
    // some errors which TypeScript reports in its type checker. We report
    // every error oxc collects.
    let syntax_errors: Vec<Diagnostic> = source_files
        .iter()
        .flat_map(|source_file| {
            source_file.syntax_errors.iter().map(|error| {
                ts_err(
                    TsLocatableNode::new(source_file, error.span),
                    error.message.clone(),
                    None,
                    None,
                )
            })
        })
        .collect();
    if !syntax_errors.is_empty() {
        return Err(syntax_errors);
    }

    let snapshots = collect_results(
        source_files
            .iter()
            .map(|source_file| extract(source_file, &config, &grats_root, sources)),
    )?;
    let mut snapshot = combine_snapshots(snapshots);
    let definitions = std::mem::take(&mut snapshot.definitions);
    let diagnostics_by_handle = std::mem::take(&mut snapshot.diagnostics_by_handle);
    let types_with_typename = std::mem::take(&mut snapshot.types_with_typename);

    // PORT: These validations run before `TypeContext.fromSnapshot`, which
    // takes the snapshot, but its errors are still reported first.
    let validation_result = concat_results(
        validate_merged_interfaces(resolver, &snapshot.interface_declarations),
        validate_duplicate_context_or_info(
            snapshot
                .name_definitions
                .iter()
                .map(|(_, name_definition)| &name_definition.definition),
        ),
    );

    let ctx = TypeContext::from_snapshot(resolver, snapshot)?;

    validation_result?;

    // Filter out any `implements` clauses that are not GraphQL interfaces.
    let definitions = filter_non_gql_interfaces(&ctx, definitions);
    // Determine which positional resolver arguments: GraphQL arguments,
    // context, derived context, or info.
    let doc = resolve_resolver_params(&ctx, &diagnostics_by_handle, definitions)
        // Follow TypeScript type references to determine the GraphQL types
        // being referenced.
        .and_then(|definitions| resolve_types(&ctx, definitions))
        // Convert string literals used as default values for enums into GraphQL
        // enums where appropriate.
        .map(coerce_default_enum_values)
        // If you define a field on an interface using the functional style, we
        // need to add that field to each concrete type as well. This must be
        // done after all types are created, but before we validate the schema.
        .and_then(|definitions| add_interface_fields(&ctx, definitions))
        // Convert the definitions into a DocumentNode
        .map(|definitions| DocumentNode {
            loc: None,
            definitions,
        })
        // Ensure all subscription fields return an AsyncIterable.
        .and_then(validate_async_iterable)
        // Apply default nullability to fields and arguments, and detect any misuse of
        // `@killsParentOnException`.
        .and_then(|doc| apply_default_nullability(doc, &config, sources))
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

// Given a list of snapshots, merge them into a single snapshot.
//
// PORT: TypeScript merges the maps, but no two snapshots share a key.
fn combine_snapshots(snapshots: Vec<ExtractionSnapshot>) -> ExtractionSnapshot {
    let mut result = ExtractionSnapshot {
        definitions: Vec::new(),
        name_definitions: Vec::new(),
        implicit_name_definitions: Vec::new(),
        unresolved_names: Vec::new(),
        types_with_typename: HashSet::new(),
        interface_declarations: Vec::new(),
        diagnostics_by_handle: HashMap::new(),
    };

    for snapshot in snapshots {
        result.definitions.extend(snapshot.definitions);
        result.name_definitions.extend(snapshot.name_definitions);
        result.unresolved_names.extend(snapshot.unresolved_names);
        result
            .implicit_name_definitions
            .extend(snapshot.implicit_name_definitions);
        result
            .types_with_typename
            .extend(snapshot.types_with_typename);
        result
            .interface_declarations
            .extend(snapshot.interface_declarations);
        result
            .diagnostics_by_handle
            .extend(snapshot.diagnostics_by_handle);
    }

    result
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
