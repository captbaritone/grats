//! Grats extracts a GraphQL schema from TypeScript code annotated with
//! docblock tags, and generates an executable schema for it.

pub mod cli;
pub mod code_actions;
pub mod codegen;
pub mod codegen_helpers;
pub mod comments;
pub mod errors;
pub mod extractor;
pub mod files;
pub mod fix_fixable;
pub mod graphql_constructor;
pub mod grats_config;
pub mod host;
pub mod interface_graph;
pub mod jsdoc;
pub mod json_spans;
pub mod locate;
pub mod metadata;
pub mod name_resolver;
pub mod oxc_name_resolver;
pub mod pipeline;
pub mod print_schema;
pub mod program;
pub mod project;
pub mod public_directives;
pub mod snapshot_refs;
pub mod source_table;
pub mod transforms;
pub mod tsconfig_compat;
pub mod type_context;
pub mod utils;
pub mod validations;
