//! Grats' options, set under the `grats` key of `tsconfig.json`.
//!
//! `GratsConfig` is their spec: their docs, defaults and types are derived
//! from it as a JSON Schema (see [`json_schema`]), which is checked in as
//! `grats-config-schema.json` and rendered by the website's docs and
//! playground. Invalid options are reported with serde's errors.

use schemars::{JsonSchema, Schema};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;

/// Grats' options, set under the `grats` key of `tsconfig.json`. Each
/// description is a series of paragraphs, separated by blank lines.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase", default, deny_unknown_fields)]
pub struct GratsConfig {
    /// Where Grats should write your schema file. Path is relative to the
    /// `tsconfig.json` file.
    pub graphql_schema: String,
    /// Where Grats should write your executable TypeScript schema file. Path
    /// is relative to the `tsconfig.json` file.
    pub ts_schema: String,
    /// Where Grats should write your TypeScript enums file. Path is relative
    /// to the `tsconfig.json` file.
    ///
    /// If enabled, Grats will require that all GraphQL enums be defined using
    /// exported TypeScript enums. Set to `null` to disable emitting this file.
    pub ts_client_enums: Option<String>,
    /// Should all fields be typed as nullable in accordance with GraphQL best
    /// practices?
    ///
    /// https://graphql.org/learn/best-practices/#nullability
    ///
    /// Individual fields can declare themselves as non-nullable by adding the
    /// docblock tag `@killsParentOnException`.
    pub nullable_by_default: bool,
    /// Experimental feature to add `@semanticNonNull` to all fields which have
    /// non-null TypeScript return types, but which are made nullable by the
    /// `nullableByDefault` option.
    ///
    /// This feature allows clients which handle errors out of band, for
    /// example by discarding responses with errors, to know which fields are
    /// expected to be non-null in the absence of errors.
    ///
    /// See https://grats.capt.dev/docs/guides/strict-semantic-nullability
    ///
    /// It is an error to enable `strictSemanticNullability` if
    /// `nullableByDefault` is false.
    pub strict_semantic_nullability: bool,
    /// A string to prepend to the generated schema text. Useful for copyright
    /// headers or instructions for how to regenerate the file. Set to `null`
    /// to omit the default header.
    #[serde(deserialize_with = "long_string")]
    #[schemars(with = "Option<LongString>")]
    pub schema_header: Option<String>,
    /// A string to prepend to the generated TypeScript schema file. Useful for
    /// copyright headers or instructions for how to regenerate the file. Set
    /// to `null` to omit the default header.
    #[serde(deserialize_with = "long_string")]
    #[schemars(with = "Option<LongString>")]
    pub ts_schema_header: Option<String>,
    /// A string to prepend to the TypeScript enums file generated when the
    /// `tsClientEnums` configuration options is set. Useful for copyright
    /// headers or instructions for how to regenerate the file. Set to `null`
    /// to omit the default header.
    #[serde(deserialize_with = "long_string")]
    #[schemars(with = "Option<LongString>")]
    pub ts_client_enums_header: Option<String>,
    /// This option allows you configure an extension that will be appended to
    /// the end of all import paths in the generated TypeScript schema file.
    ///
    /// When building a package that uses ES modules, import paths must not
    /// omit the file extension. In TypeScript code this generally means import
    /// paths must end with `.js`. If set to null, no ending will be appended.
    pub import_module_specifier_ending: String,
    /// EXPERIMENTAL: THIS OPTION WILL BE RENAMED OR REMOVED IN A FUTURE RELEASE
    ///
    /// Emit a JSON file alongside the generated schema file which contains the
    /// metadata containing information about the resolvers.
    #[serde(rename = "EXPERIMENTAL__emitMetadata")]
    #[schemars(extend("experimental" = true))]
    pub experimental_emit_metadata: bool,
    /// EXPERIMENTAL: THIS OPTION WILL BE RENAMED OR REMOVED IN A FUTURE RELEASE
    ///
    /// Instead of emitting a TypeScript file which creates a GraphQLSchema,
    /// emit a TypeScript file which creates a GraphQL Tools style Resolver
    /// Map.
    ///
    /// https://the-guild.dev/graphql/tools/docs/resolvers#resolver-map
    #[serde(rename = "EXPERIMENTAL__emitResolverMap")]
    #[schemars(extend("experimental" = true))]
    pub experimental_emit_resolver_map: bool,
}

impl Default for GratsConfig {
    fn default() -> Self {
        GratsConfig {
            graphql_schema: "./schema.graphql".to_string(),
            ts_schema: "./schema.ts".to_string(),
            ts_client_enums: None,
            nullable_by_default: true,
            strict_semantic_nullability: false,
            schema_header: Some(
                "# Schema generated by Grats (https://grats.capt.dev)\n\
                 # Do not manually edit. Regenerate by running `npx grats`."
                    .to_string(),
            ),
            ts_schema_header: Some(
                "/**\n \
                 * Executable schema generated by Grats (https://grats.capt.dev)\n \
                 * Do not manually edit. Regenerate by running `npx grats`.\n \
                 */"
                .to_string(),
            ),
            ts_client_enums_header: Some(
                "/**\n \
                 * TypeScript enum definitions generated by Grats (https://grats.capt.dev)\n \
                 * Do not manually edit. Regenerate by running `npx grats`.\n \
                 */"
                .to_string(),
            ),
            import_module_specifier_ending: String::new(),
            experimental_emit_metadata: false,
            experimental_emit_resolver_map: false,
        }
    }
}

/// A string, which may be given as an array of lines.
#[derive(Deserialize, JsonSchema)]
#[serde(untagged, expecting = "expected a string or an array of strings")]
enum LongString {
    String(String),
    Lines(Vec<String>),
}

fn long_string<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<String>, D::Error> {
    Ok(
        Option::<LongString>::deserialize(deserializer)?.map(|value| match value {
            LongString::String(string) => string,
            LongString::Lines(lines) => lines.join("\n"),
        }),
    )
}

/// The JSON Schema of the options.
pub fn json_schema() -> Schema {
    schemars::schema_for!(GratsConfig)
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

/// Validates the `grats` key of `tsconfig.json`, filling in the defaults of
/// options it doesn't set.
pub fn validate_grats_options(options: Option<&Value>) -> Result<ValidatedConfig, String> {
    let options = match options {
        None | Some(Value::Null) => serde_json::Map::new(),
        Some(Value::Object(options)) => options.clone(),
        Some(_) => return Err("Expected the Grats config to be an object.".to_string()),
    };
    if let Some((key, removed)) = REMOVED_OPTIONS
        .iter()
        .find(|(key, _)| options.contains_key(*key))
    {
        return Err(format!(
            "The Grats config option `{key}` has been removed. {removed}"
        ));
    }
    let schema = json_schema();
    let warnings = options
        .iter()
        .filter(|(key, value)| {
            schema.as_value()["properties"][key]["experimental"] == true && !value.is_null()
        })
        .map(|(key, _)| format!(
            "Grats: The `{key}` option is experimental and will be renamed or removed in a future release."
        ))
        .collect();
    let config = serde_path_to_error::deserialize(Value::Object(options))
        .map_err(|error| format!("Invalid Grats config: {error}"))?;
    Ok(ValidatedConfig { config, warnings })
}
