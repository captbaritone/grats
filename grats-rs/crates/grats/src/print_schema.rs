//! Prints the outputs of a validated schema document.

use graphql_js::language::ast::{DefinitionNode, DocumentNode};
use graphql_js::language::printer::print_definition;
use graphql_js::r#type::scalars::specified_scalar_types;
use graphql_js::r#type::schema::GraphQLSchema;
use serde::Serialize;

use crate::codegen::enum_codegen::codegen_enums;
use crate::codegen::resolver_map_codegen::resolver_map_codegen;
use crate::codegen::schema_codegen::codegen;
use crate::grats_config::GratsConfig;
use crate::metadata::Metadata;

/// The absolute paths the TypeScript outputs will be written to, which the
/// module paths they import are relative to.
#[derive(Debug)]
pub struct OutputPaths {
    pub ts_schema: String,
    /// Set if, and only if, the config's `tsClientEnums` is.
    pub ts_client_enums: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Outputs {
    pub graphql_schema: String,
    pub ts_schema: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ts_client_enums: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<String>,
}

/// Prints code for a TypeScript module that exports a GraphQLSchema.
/// Includes the user-defined (or default) header comment if provided.
pub fn print_executable_schema(
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
pub fn print_enums_module(
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
pub fn print_grats_sdl(doc: &DocumentNode, config: &GratsConfig) -> String {
    let sdl = print_sdl_without_metadata(doc);
    format_header(config.schema_header.as_deref(), &sdl) + "\n"
}

/// Prints the resolver metadata like `JSON.stringify(resolvers, null, 2)`.
pub fn print_metadata(resolvers: &Metadata) -> String {
    serde_json::to_string_pretty(resolvers).expect("Metadata serializes to JSON")
}

/// Prints the document as SDL, leaving out the definitions of the built-in
/// scalars.
pub fn print_sdl_without_metadata(doc: &DocumentNode) -> String {
    let definitions: Vec<String> = doc
        .definitions
        .iter()
        .filter(|def| !is_built_in_scalar(def))
        .map(print_definition)
        .collect();
    definitions.join("\n\n")
}

fn is_built_in_scalar(def: &DefinitionNode) -> bool {
    let DefinitionNode::ScalarTypeDefinition(def) = def else {
        return false;
    };
    specified_scalar_types()
        .iter()
        .any(|scalar| scalar.name == def.name.value)
}

fn format_header(header: Option<&str>, code: &str) -> String {
    match header {
        Some(header) => format!("{header}\n\n{code}"),
        None => code.to_string(),
    }
}
