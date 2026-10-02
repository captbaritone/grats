//! Grats' pipeline: a TypeScript program goes in, a GraphQL schema comes out,
//! as SDL and as executable TypeScript.
//!
//! 1. `extract` GraphQL definitions from each file's docblocks.
//! 2. `resolve` the TypeScript types those definitions reference.
//! 3. `transform` the definitions into a complete schema document.
//! 4. `validate` the schema that document describes.
//! 5. `print` the schema's outputs.
//!
//! Each step reports every error it finds, and the first step that finds any
//! stops the pipeline.

use std::collections::HashSet;
use std::mem;
use std::rc::Rc;
use std::sync::Arc;

use graphql_js::error::graphql_error::GraphQLError;
use graphql_js::language::ast::{DefinitionNode, DocumentNode};
use graphql_js::r#type::schema::GraphQLSchema;
use graphql_js::r#type::validate::validate_schema;
use graphql_js::utilities::build_ast_schema::build_ast_schema;
use graphql_js::validation::validate::validate_sdl;
use oxc_allocator::Allocator;

use crate::extractor::{self, ExtractionSnapshot};
use crate::files::{Files, ParsedFile};
use crate::grats_config::GratsConfig;
use crate::host::Host;
use crate::name_resolver::NameResolver;
use crate::oxc_name_resolver::OxcNameResolver;
use crate::print_schema::{
    OutputPaths, Outputs, print_enums_module, print_executable_schema, print_grats_sdl,
    print_metadata,
};
use crate::program::{Program, ProgramOptions};
use crate::source_table::SourceTable;
use crate::transforms::{
    add_implicit_root_types, add_interface_fields, apply_default_nullability,
    coerce_default_enum_values, filter_non_gql_interfaces, make_resolver_signature,
    merge_extensions, resolve_resolver_params, resolve_types, sort_schema_ast,
};
use crate::type_context::TypeContext;
use crate::utils::diagnostic_error::{
    DiagnosticsResult, TsLocatableNode, graphql_error_to_diagnostic, ts_err,
};
use crate::utils::result::{collect_results, ok_unless_errors};
use crate::validations::{
    custom_spec_validations, validate_async_iterable, validate_directive_arguments,
    validate_duplicate_context_or_info, validate_merged_interfaces, validate_semantic_nullability,
    validate_some_types_are_defined, validate_typenames,
};

/// What the pipeline builds: the schema's document, and the outputs printed
/// from it.
#[derive(Debug)]
pub struct Compiled {
    pub doc: DocumentNode,
    pub outputs: Outputs,
}

/// Builds the schema from the files of the program which `program_options`
/// describes, and prints its outputs for `output_paths`.
pub fn run(
    config: &GratsConfig,
    grats_root: &str,
    program_options: &ProgramOptions,
    host: Arc<dyn Host>,
    sources: &SourceTable,
    output_paths: &OutputPaths,
) -> DiagnosticsResult<Compiled> {
    // The program's files, and everything read out of them, are scoped so that
    // they are dropped before the outputs are printed. The document is all
    // printing needs, and the parsed files behind it are far larger: printing
    // while they were still alive cost ~130MB of peak heap on a 10,000 file
    // project.
    let (doc, types_with_typename) = {
        let allocator = Allocator::default();
        let case_sensitive = program_options.use_case_sensitive_file_names;
        let files = Files::new(&allocator, &*host, sources, case_sensitive);
        let program = Program::new(&files, Arc::clone(&host), program_options);
        let resolver = OxcNameResolver::new(&files, &program);

        let mut snapshot = extract(&program, config, grats_root)?;
        let types_with_typename = mem::take(&mut snapshot.types_with_typename);
        let definitions = resolve(&resolver, snapshot)?;
        (transform(definitions, config)?, types_with_typename)
    };
    let schema = validate(&doc, &types_with_typename, config)?;
    let outputs = print(&doc, &schema, config, grats_root, output_paths);
    Ok(Compiled { doc, outputs })
}

/// Extracts the GraphQL definitions in the program's files, and the
/// TypeScript names they reference.
fn extract(
    program: &Program,
    config: &GratsConfig,
    grats_root: &str,
) -> DiagnosticsResult<ExtractionSnapshot> {
    let source_files = program.grats_source_files();
    // Syntax errors would keep us from extracting any GraphQL definitions.
    check_syntax(&source_files)?;
    collect_results(
        source_files
            .iter()
            .map(|source_file| extractor::extract(source_file, config, grats_root)),
    )
}

/// Resolves the TypeScript types which the extracted definitions reference to
/// the GraphQL types they name.
fn resolve(
    resolver: &dyn NameResolver,
    snapshot: ExtractionSnapshot,
) -> DiagnosticsResult<Vec<DefinitionNode>> {
    let ExtractionSnapshot {
        definitions,
        unresolved_names,
        name_definitions,
        implicit_name_definitions,
        interface_declarations,
        diagnostics_by_handle,
        ..
    } = snapshot;

    // Checked first, so their errors come before `TypeContext`'s.
    collect_results::<(), _, _>([
        validate_merged_interfaces(resolver, &interface_declarations),
        validate_duplicate_context_or_info(
            name_definitions.iter().map(|(_, entry)| &entry.definition),
        ),
    ])?;
    let ctx = TypeContext::new(
        resolver,
        unresolved_names,
        name_definitions,
        implicit_name_definitions,
    )?;

    // Drop `implements` clauses which don't name GraphQL interfaces.
    let definitions = filter_non_gql_interfaces(&ctx, definitions);
    // Classify each resolver parameter: arguments, context, derived context,
    // or info.
    let definitions = resolve_resolver_params(&ctx, &diagnostics_by_handle, definitions)?;
    // Follow TypeScript type references to the GraphQL types they name.
    let definitions = resolve_types(&ctx, definitions)?;
    // Turn string literal defaults of enum arguments into enum values.
    let definitions = coerce_default_enum_values(definitions);
    // Copy fields defined on interfaces in the functional style onto each
    // implementor.
    add_interface_fields(&ctx, definitions)
}

/// Assembles the definitions into a complete, sorted schema document.
fn transform(
    definitions: Vec<DefinitionNode>,
    config: &GratsConfig,
) -> DiagnosticsResult<DocumentNode> {
    let doc = DocumentNode {
        loc: None,
        definitions,
    };
    // Ensure every subscription field returns an AsyncIterable.
    let doc = validate_async_iterable(doc)?;
    // Apply default nullability, and catch misuse of `@killsParentOnException`.
    let doc = apply_default_nullability(doc, config)?;
    // Define Query/Mutation/Subscription if `@gqlQueryField` and friends
    // extend them.
    let doc = add_implicit_root_types(doc);
    // Merge `extend` definitions into the definitions they extend.
    let doc = merge_extensions(doc);
    // Spec rules, checked here for more helpful messages than graphql-js'.
    let doc = custom_spec_validations(doc)?;
    // Sort the definitions so the output is stable.
    Ok(sort_schema_ast(doc))
}

/// Validates the schema which the document describes, per the GraphQL spec and
/// Grats' own rules.
fn validate<'d>(
    doc: &'d DocumentNode,
    types_with_typename: &HashSet<String>,
    config: &GratsConfig,
) -> DiagnosticsResult<GraphQLSchema<'d>> {
    // TODO: This misses definitions which shadow built-in scalars (`String`,
    // `Int`, etc), which validating as an extension of a schema would catch.
    as_diagnostics(validate_sdl(doc))?;
    let schema = build_ast_schema(doc);
    // The spec's "Type Validation" rules.
    as_diagnostics(validate_schema(&schema))?;
    // A helpful getting started error if no types are defined.
    validate_some_types_are_defined(doc)?;
    // The spec validation misses type errors in directive arguments.
    validate_directive_arguments(&schema, doc)?;
    // Ensure each member of a union or interface has a `__typename` field.
    validate_typenames(&schema, types_with_typename)?;
    // Ensure semantic nullability directives agree with type nullability.
    validate_semantic_nullability(&schema, config)?;
    Ok(schema)
}

/// Prints the schema as SDL and as an executable TypeScript module, and
/// whichever other outputs the config asks for.
fn print(
    doc: &DocumentNode,
    schema: &GraphQLSchema,
    config: &GratsConfig,
    grats_root: &str,
    paths: &OutputPaths,
) -> Outputs {
    let resolvers = make_resolver_signature(doc);
    let print_enums =
        |destination: &String| print_enums_module(schema, config, destination, grats_root);
    Outputs {
        graphql_schema: print_grats_sdl(doc, config),
        ts_schema: print_executable_schema(
            schema,
            &resolvers,
            config,
            &paths.ts_schema,
            grats_root,
        ),
        ts_client_enums: paths.ts_client_enums.as_ref().map(print_enums),
        metadata: config
            .experimental_emit_metadata
            .then(|| print_metadata(&resolvers)),
    }
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
    ok_unless_errors(errors.collect(), ())
}

/// Reports graphql-js validation errors as diagnostics.
fn as_diagnostics(errors: Vec<GraphQLError>) -> DiagnosticsResult<()> {
    // FIXME: Handle case where query is not defined (no location)
    let located = errors
        .iter()
        .filter(|e| e.nodes.iter().any(Option::is_some));
    ok_unless_errors(located.map(graphql_error_to_diagnostic).collect(), ())
}
