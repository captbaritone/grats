//! Grats' pipeline: extracts GraphQL definitions from the program's files,
//! resolves the TypeScript types they reference, then transforms and validates
//! the resulting document.

use std::rc::Rc;
use std::sync::Arc;

use graphql_js::error::graphql_error::GraphQLError;
use graphql_js::language::ast::DocumentNode;
use graphql_js::r#type::validate::validate_schema;
use graphql_js::utilities::build_ast_schema::build_ast_schema;
use graphql_js::validation::validate::validate_sdl;
use oxc_allocator::Allocator;

use crate::extractor::{ExtractionSnapshot, extract};
use crate::files::{Files, ParsedFile};
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
    Diagnostic, DiagnosticsResult, DiagnosticsWithoutLocationResult, TsLocatableNode,
    graphql_error_to_diagnostic, ts_err,
};
use crate::utils::result::collect_results;
use crate::validations::custom_spec_validations::custom_spec_validations;
use crate::validations::validate_async_iterable::validate_async_iterable;
use crate::validations::validate_directive_arguments::validate_directive_arguments;
use crate::validations::validate_duplicate_context_or_info::validate_duplicate_context_or_info;
use crate::validations::validate_merged_interfaces::validate_merged_interfaces;
use crate::validations::validate_semantic_nullability::validate_semantic_nullability;
use crate::validations::validate_some_types_are_defined::validate_some_types_are_defined;
use crate::validations::validate_typenames::validate_typenames;

/// Builds the schema's document from the files of the program which
/// `program_options` describes.
pub fn run(
    config: &GratsConfig,
    grats_root: &str,
    program_options: &ProgramOptions,
    host: Arc<dyn Host>,
    sources: &SourceTable,
) -> DiagnosticsWithoutLocationResult<DocumentNode> {
    let allocator = Allocator::default();
    let files = Files::new(
        &allocator,
        &*host,
        sources,
        program_options.use_case_sensitive_file_names,
    );
    let program = Program::new(&files, Arc::clone(&host), program_options);
    let resolver = OxcNameResolver::new(&files, &program);

    let source_files = program.grats_source_files();
    // Syntax errors will prevent us from extracting any GraphQL definitions.
    check_syntax(&source_files)?;
    let ExtractionSnapshot {
        definitions,
        unresolved_names,
        name_definitions,
        implicit_name_definitions,
        types_with_typename,
        interface_declarations,
        diagnostics_by_handle,
    } = collect_results(
        source_files
            .iter()
            .map(|source_file| extract(source_file, config, grats_root)),
    )?;

    // These need the name definitions, which `TypeContext` takes, but its
    // errors are reported first.
    collect_results::<(), _, _>([
        validate_merged_interfaces(&resolver, &interface_declarations),
        validate_duplicate_context_or_info(
            name_definitions.iter().map(|(_, entry)| &entry.definition),
        ),
    ])?;

    let ctx = TypeContext::new(
        &resolver,
        unresolved_names,
        name_definitions,
        implicit_name_definitions,
    )?;

    // Filter out any `implements` clauses that are not GraphQL interfaces.
    let definitions = filter_non_gql_interfaces(&ctx, definitions);
    // Determine which positional resolver arguments: GraphQL arguments,
    // context, derived context, or info.
    let definitions = resolve_resolver_params(&ctx, &diagnostics_by_handle, definitions)?;
    // Follow TypeScript type references to determine the GraphQL types being
    // referenced.
    let definitions = resolve_types(&ctx, definitions)?;
    // Convert string literals used as default values for enums into GraphQL
    // enums where appropriate.
    let definitions = coerce_default_enum_values(definitions);
    // If you define a field on an interface using the functional style, we
    // need to add that field to each concrete type as well. This must be done
    // after all types are created, but before we validate the schema.
    let definitions = add_interface_fields(&ctx, definitions)?;

    let doc = DocumentNode {
        loc: None,
        definitions,
    };
    // Ensure all subscription fields return an AsyncIterable.
    let doc = validate_async_iterable(doc)?;
    // Apply default nullability to fields and arguments, and detect any misuse
    // of `@killsParentOnException`.
    let doc = apply_default_nullability(doc, config)?;
    // Ensure we have Query/Mutation/Subscription types if they've been
    // extended with `@gqlQueryField` and friends.
    let doc = add_implicit_root_types(doc);
    // Merge any `extend` definitions into their base definitions.
    let doc = merge_extensions(doc);
    // Perform custom validations that reimplement spec validation rules with
    // more tailored error messages.
    let doc = custom_spec_validations(doc)?;
    // Sort the definitions in the document to ensure a stable output.
    let doc = sort_schema_ast(doc);
    // TODO: Currently this does not detect definitions that shadow builtins
    // (`String`, `Int`, etc). However, if we pass a second param (extending an
    // existing schema) we do! So, we should find a way to validate that we don't
    // shadow builtins.
    graphql_errors(validate_sdl(&doc))?;
    let schema = build_ast_schema(&doc);
    // Apply the "Type Validation" sub-sections of the specification's "Type
    // System" section.
    graphql_errors(validate_schema(&schema))?;
    // Provide a helpful getting started error if no types are detected.
    validate_some_types_are_defined(&schema)?;
    // The above spec validation fails to catch type errors in directive
    // arguments, so Grats checks these manually.
    validate_directive_arguments(&schema, &doc)?;
    // Ensure that every type which implements an interface or is a member of a
    // union has a __typename field.
    validate_typenames(&schema, &types_with_typename)?;
    // Validate that semantic nullability directives are not in conflict with
    // type nullability.
    validate_semantic_nullability(&schema, config)?;

    Ok(doc)
}

fn check_syntax(source_files: &[Rc<ParsedFile>]) -> DiagnosticsResult<()> {
    let errors = source_files.iter().flat_map(|source_file| {
        source_file.syntax_errors.iter().map(|error| {
            ts_err(
                TsLocatableNode::new(source_file, error.span),
                error.message.clone(),
                None,
                None,
            )
        })
    });
    as_result(errors.collect())
}

/// Reports graphql-js validation errors as diagnostics.
fn graphql_errors(errors: Vec<GraphQLError>) -> DiagnosticsResult<()> {
    // FIXME: Handle case where query is not defined (no location)
    let located = errors
        .iter()
        .filter(|e| e.nodes.iter().any(Option::is_some));
    as_result(located.map(graphql_error_to_diagnostic).collect())
}

fn as_result(errors: Vec<Diagnostic>) -> DiagnosticsResult<()> {
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}
