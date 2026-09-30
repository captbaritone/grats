//! A port of Grats. Modules mirror the TypeScript implementation's `src/`
//! paths so that each can be compared against its source.

pub mod code_actions;
pub mod codegen;
pub mod codegen_helpers;
pub mod comments;
pub mod errors;
pub mod extractor;
pub mod files;
pub mod graphql_constructor;
pub mod grats_config;
pub mod grats_root;
pub mod host;
pub mod interface_graph;
pub mod jsdoc;
pub mod locate;
pub mod metadata;
pub mod name_resolver;
pub mod oxc_name_resolver;
pub mod pipeline;
pub mod print_schema;
pub mod program;
pub mod public_directives;
pub mod snapshot_refs;
pub mod transforms;
pub mod type_context;
pub mod utils;
pub mod validations;
