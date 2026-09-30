//! Port of the pipeline in `extractSchemaAndDoc` in `src/lib.ts`.
//!
//! PORT: Only the end of the pipeline has been ported. The TypeScript side runs
//! the rest, then calls `validate` with the document. (A crate's `lib.rs` is
//! its root, so this module can't share the TypeScript file's name.)

use graphql_js::language::ast::DocumentNode;
use graphql_js::utilities::build_ast_schema::build_ast_schema;
use serde::Deserialize;

use crate::grats_config::GratsConfig;
use crate::utils::diagnostic_error::DiagnosticsWithoutLocationResult;
use crate::validations::validate_semantic_nullability::validate_semantic_nullability;

/// PORT: The input to `validate` from TypeScript, besides the document.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateRequest {
    pub config: GratsConfig,
}

/// PORT: The validations which follow `validateTypenames` in
/// `extractSchemaAndDoc`, which build their own schema from the document.
pub fn validate(
    doc: &DocumentNode,
    request: ValidateRequest,
) -> DiagnosticsWithoutLocationResult<()> {
    let config = &request.config;
    Ok(build_ast_schema(doc))
        // Validate that semantic nullability directives are not in conflict
        // with type nullability.
        .and_then(|schema| validate_semantic_nullability(schema, config))
        .map(|_schema| ())
}
