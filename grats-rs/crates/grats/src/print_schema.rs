//! Prints the outputs of a validated schema document.

use graphql_js::language::ast::{DefinitionNode, DocumentNode};
use graphql_js::language::printer::print;
use graphql_js::r#type::scalars::specified_scalar_types;
use graphql_js::r#type::schema::GraphQLSchema;
use graphql_js::utilities::build_ast_schema::build_ast_schema;
use serde::Serialize;

use crate::codegen::enum_codegen::codegen_enums;
use crate::codegen::resolver_map_codegen::resolver_map_codegen;
use crate::codegen::schema_codegen::codegen;
use crate::grats_config::GratsConfig;
use crate::metadata::Metadata;
use crate::transforms::make_resolver_signature::make_resolver_signature;
use crate::utils::visitor::map_definitions;

/// Which outputs `print_outputs` should print, and the config to print them
/// with.
#[derive(Debug)]
pub struct OutputRequest {
    pub config: GratsConfig,
    /// The root which module paths are relative to. See `crate::grats_root`.
    pub grats_root: String,
    /// Whether to print the SDL.
    pub graphql_schema: bool,
    /// The absolute path the executable schema module will be written to, if
    /// it should be printed.
    pub ts_schema: Option<String>,
    /// The absolute path the enums module will be written to, if it should be
    /// printed.
    pub ts_client_enums: Option<String>,
    /// Whether to print the resolver metadata as JSON.
    pub metadata: bool,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Outputs {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub graphql_schema: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ts_schema: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ts_client_enums: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<String>,
}

/// Prints each requested output.
pub fn print_outputs(doc: &DocumentNode, request: OutputRequest) -> Outputs {
    let OutputRequest {
        config,
        grats_root,
        graphql_schema,
        ts_schema,
        ts_client_enums,
        metadata,
    } = request;
    let resolvers = make_resolver_signature(doc);
    let mut outputs = Outputs {
        graphql_schema: graphql_schema.then(|| print_grats_sdl(doc, &config)),
        // Matches `JSON.stringify(resolvers, null, 2)`.
        metadata: metadata.then(|| {
            serde_json::to_string_pretty(&resolvers).expect("Metadata serializes to JSON")
        }),
        ..Outputs::default()
    };
    if ts_schema.is_some() || ts_client_enums.is_some() {
        let schema = build_ast_schema(doc);
        outputs.ts_schema = ts_schema.map(|destination| {
            print_executable_schema(&schema, &resolvers, &config, &destination, &grats_root)
        });
        outputs.ts_client_enums = ts_client_enums
            .map(|destination| print_enums_module(&schema, &config, &destination, &grats_root));
    }
    outputs
}

/// Prints code for a TypeScript module that exports a GraphQLSchema.
/// Includes the user-defined (or default) header comment if provided.
fn print_executable_schema(
    schema: &GraphQLSchema,
    resolvers: &Metadata,
    config: &GratsConfig,
    destination: &str,
    grats_root: &str,
) -> String {
    let code = if config.experimental_emit_resolver_map {
        resolver_map_codegen(schema, resolvers, config, destination, grats_root)
    } else {
        codegen(schema, resolvers, config, destination, grats_root)
    };
    format_header(config.ts_schema_header.as_deref(), &code)
}

/// Prints TypeScript code for a module that exports all enums.
/// Includes the user-defined (or default) header comment if provided.
fn print_enums_module(
    schema: &GraphQLSchema,
    config: &GratsConfig,
    destination: &str,
    grats_root: &str,
) -> String {
    let code = codegen_enums(schema, config, destination, grats_root);
    format_header(config.ts_client_enums_header.as_deref(), &code)
}

/// Prints SDL, potentially omitting directives depending upon the config.
/// Includes the user-defined (or default) header comment if provided.
fn print_grats_sdl(doc: &DocumentNode, config: &GratsConfig) -> String {
    let sdl = print_sdl_without_metadata(doc);
    format_header(config.schema_header.as_deref(), &sdl) + "\n"
}

/// Prints the document as SDL, leaving out the definitions of the built-in
/// scalars.
pub fn print_sdl_without_metadata(doc: &DocumentNode) -> String {
    let trimmed = map_definitions(doc.clone(), |def| match def {
        DefinitionNode::ScalarTypeDefinition(t)
            if specified_scalar_types()
                .iter()
                .any(|scalar| scalar.name == t.name.value) =>
        {
            None
        }
        def => Some(def),
    });
    print(&trimmed)
}

fn format_header(header: Option<&str>, code: &str) -> String {
    match header {
        Some(header) => format!("{header}\n\n{code}"),
        None => code.to_string(),
    }
}
