//! Port of `src/gratsConfig.ts`.
//!
//! PORT: The config is parsed and validated on the TypeScript side. This only
//! models the fields read by ported code.

use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GratsConfig {
    pub schema_header: Option<String>,
    pub ts_schema_header: Option<String>,
    pub ts_client_enums_header: Option<String>,
    pub import_module_specifier_ending: String,
    #[serde(rename = "EXPERIMENTAL__emitResolverMap", default)]
    pub experimental_emit_resolver_map: bool,
}
