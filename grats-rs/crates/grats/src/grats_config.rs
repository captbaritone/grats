//! Port of `src/gratsConfig.ts`.
//!
//! PORT: `src/configSpecRaw.json` describes the options, and generates the
//! `GratsConfig` TypeScript type and the docs. Here, it provides their
//! defaults and says which are experimental. The TypeScript side reported
//! its own errors for invalid options; we report serde's.

use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;

/// The options, in the spec's order.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GratsConfig {
    pub graphql_schema: String,
    pub ts_schema: String,
    pub ts_client_enums: Option<String>,
    pub nullable_by_default: bool,
    pub strict_semantic_nullability: bool,
    #[serde(deserialize_with = "long_string")]
    pub schema_header: Option<String>,
    #[serde(deserialize_with = "long_string")]
    pub ts_schema_header: Option<String>,
    #[serde(deserialize_with = "long_string")]
    pub ts_client_enums_header: Option<String>,
    pub import_module_specifier_ending: String,
    #[serde(rename = "EXPERIMENTAL__emitMetadata")]
    pub experimental_emit_metadata: bool,
    #[serde(rename = "EXPERIMENTAL__emitResolverMap")]
    pub experimental_emit_resolver_map: bool,
}

/// A string, which may be given as an array of lines.
fn long_string<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<String>, D::Error> {
    #[derive(Deserialize)]
    #[serde(untagged, expecting = "expected a string or an array of strings")]
    enum LongString {
        String(String),
        Lines(Vec<String>),
    }
    Ok(
        Option::<LongString>::deserialize(deserializer)?.map(|value| match value {
            LongString::String(string) => string,
            LongString::Lines(lines) => lines.join("\n"),
        }),
    )
}

/// A validated config, and the warnings to report about it.
#[derive(Debug, Serialize)]
pub struct ValidatedConfig {
    pub config: GratsConfig,
    pub warnings: Vec<String>,
}

/// Options which Grats no longer supports, and how to migrate away from each.
const REMOVED_OPTIONS: [(&str, &str); 1] = [(
    "reportTypeScriptTypeErrors",
    "Grats no longer type checks your code. Run `tsc` to report TypeScript type errors.",
)];

/// `validateGratsOptions`: validates the `grats` key of `tsconfig.json`,
/// filling in the defaults of options it doesn't set.
pub fn validate_grats_options(options: Option<&Value>) -> Result<ValidatedConfig, String> {
    let options = match options {
        None | Some(Value::Null) => serde_json::Map::new(),
        Some(Value::Object(options)) => options.clone(),
        Some(_) => return Err("Expected the Grats config to be an object.".to_string()),
    };
    for (key, removed) in REMOVED_OPTIONS {
        if options.contains_key(key) {
            return Err(format!(
                "The Grats config option `{key}` has been removed. {removed}"
            ));
        }
    }
    let spec = spec();
    let mut warnings = Vec::new();
    for (key, value) in &options {
        let experimental = spec
            .get(key)
            .and_then(|property| property["experimental"].as_bool())
            .unwrap_or(false);
        if experimental && !value.is_null() {
            warnings.push(format!(
                "Grats: The `{key}` option is experimental and will be renamed or removed in a future release."
            ));
        }
    }
    let mut config = defaults(&spec);
    config.extend(options);
    let config = serde_path_to_error::deserialize(Value::Object(config))
        .map_err(|error| format!("Invalid Grats config: {error}"))?;
    Ok(ValidatedConfig { config, warnings })
}

/// The spec of each option, by name.
fn spec() -> serde_json::Map<String, Value> {
    let spec: Value = serde_json::from_str(include_str!("../../../../src/configSpecRaw.json"))
        .expect("The config spec should be JSON");
    match &spec["properties"] {
        Value::Object(properties) => properties.clone(),
        _ => panic!("The config spec should have properties"),
    }
}

fn defaults(spec: &serde_json::Map<String, Value>) -> serde_json::Map<String, Value> {
    spec.iter()
        .map(|(key, property)| (key.clone(), property["default"].clone()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn spec_matches_config() {
        // Fails if an option is missing from either.
        let config: GratsConfig = serde_json::from_value(Value::Object(defaults(&spec()))).unwrap();
        assert_eq!(
            serde_json::to_value(&config).unwrap(),
            Value::Object(defaults(&spec()))
        );
    }
}
