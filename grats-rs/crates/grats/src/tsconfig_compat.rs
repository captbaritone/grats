//! Checks that the Grats config and the TypeScript config agree about import
//! specifiers.
//!
//! Grats writes relative imports into the schema module it generates, ending
//! them with [`GratsConfig::import_module_specifier_ending`]. TypeScript only
//! accepts some of those endings, depending on how the project is configured,
//! so a project can be set up such that every build writes a schema module
//! which does not type check. Reporting that here, against the options which
//! disagree, is friendlier than leaving it to `tsc` to complain about a
//! generated file.
//!
//! The two ways they can disagree:
//!
//! - An empty ending under `node16`/`nodenext` module resolution, where
//!   TypeScript requires relative imports to carry an extension (TS2835).
//! - A `.ts` ending without `allowImportingTsExtensions`, which TypeScript
//!   only permits when that option is on (TS5097).

use crate::grats_config::GratsConfig;
use crate::host::FileKind;
use crate::host::Host;
use crate::json_spans::Spans;
use crate::utils::diagnostic_error::{
    CodeFixAction, Diagnostic, DiagnosticRelatedInformation, FileTextChanges, TextChange, TextSpan,
};
use crate::utils::path;
use graphql_js::language::ast::Location;
use serde_json::Value;

/// Where a `tsconfig.json` lives, and what it says, so a diagnostic can point
/// into it.
pub struct TsConfigSource<'a> {
    /// The absolute path, which a fix's changes name.
    pub path: &'a str,
    /// The file's text, which spans are offsets into.
    pub text: &'a str,
    /// The file's id in the `SourceTable`, which locations refer to.
    pub source: u32,
    /// The spans of the keys and values in the file.
    pub spans: &'a Spans,
}

/// What a config says about a boolean compiler option, which may be set in a
/// config this one extends.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Flag {
    On,
    Off,
    /// A config in the chain couldn't be read, so the option's value isn't
    /// known. Checks which depend on it are skipped rather than guessed at,
    /// so that an unreadable config can't produce an error about an option
    /// which may well be set correctly.
    Unknown,
}

/// Diagnostics for a Grats config which the TypeScript config will not accept.
pub fn check(
    config: &GratsConfig,
    ts: &TsConfigSource,
    host: &dyn Host,
    module: Option<&str>,
) -> Vec<Diagnostic> {
    let ending = config.import_module_specifier_ending.as_str();
    let mut diagnostics = Vec::new();

    if ending.is_empty()
        && let Some(mode) = module_resolution_mode(module)
    {
        diagnostics.push(missing_extension(ts, mode));
    }
    // Either option lets TypeScript accept a `.ts` specifier:
    // `allowImportingTsExtensions` permits it outright, and
    // `rewriteRelativeImportExtensions` permits it and rewrites it to `.js`
    // on emit. An option whose value can't be determined is left alone.
    if ending == ".ts"
        && flag(host, ts.path, "allowImportingTsExtensions") == Flag::Off
        && flag(host, ts.path, "rewriteRelativeImportExtensions") == Flag::Off
    {
        diagnostics.push(ts_extension_not_allowed(ts, host));
    }
    diagnostics
}

/// A boolean compiler option's value, following `extends`.
///
/// Later entries of an `extends` array win, and a config always wins over the
/// ones it extends, which is how TypeScript merges them.
pub fn flag(host: &dyn Host, config_path: &str, key: &str) -> Flag {
    flag_at(host, config_path, key, 0)
}

fn flag_at(host: &dyn Host, config_path: &str, key: &str, depth: usize) -> Flag {
    match lookup(host, config_path, key, depth) {
        Lookup::Set(true) => Flag::On,
        Lookup::Set(false) => Flag::Off,
        // An option nobody sets has its default, which for every option this
        // asks about is off.
        Lookup::Absent => Flag::Off,
        Lookup::Unknown => Flag::Unknown,
    }
}

/// What a config chain says about an option. `Absent` and `Set(false)` have
/// to be told apart: a config which extends two others takes the value from
/// the one which sets it, and only falls back to an earlier one when the
/// later is silent.
enum Lookup {
    Set(bool),
    Absent,
    Unknown,
}

fn lookup(host: &dyn Host, config_path: &str, key: &str, depth: usize) -> Lookup {
    // Deep enough to be a cycle, or a chain nobody meant to write.
    if depth > 16 {
        return Lookup::Unknown;
    }
    let Some(config) = read_json(host, config_path) else {
        return Lookup::Unknown;
    };
    match config["compilerOptions"].get(key) {
        Some(Value::Bool(value)) => return Lookup::Set(*value),
        Some(_) => return Lookup::Unknown,
        None => {}
    }
    let extends = match &config["extends"] {
        Value::String(one) => vec![one.clone()],
        Value::Array(many) => many
            .iter()
            .filter_map(|entry| entry.as_str().map(str::to_string))
            .collect(),
        _ => Vec::new(),
    };
    // Last entry first: the later a config appears, the more it wins, so the
    // first one found to say anything is the one which decides.
    for target in extends.iter().rev() {
        let Some(parent) = resolve_extends(host, config_path, target) else {
            // A package specifier like `@tsconfig/node20/tsconfig.json`,
            // which would take module resolution to find. It may well set the
            // option, so nothing below it can be trusted to be the answer.
            return Lookup::Unknown;
        };
        match lookup(host, &parent, key, depth + 1) {
            Lookup::Absent => {}
            decided => return decided,
        }
    }
    Lookup::Absent
}

fn read_json(host: &dyn Host, path: &str) -> Option<Value> {
    let mut text = host.read_file(path)?;
    json_strip_comments::strip(&mut text).ok()?;
    serde_json::from_str(&text).ok()
}

/// The path an `extends` entry names, if it's a relative or absolute one.
fn resolve_extends(host: &dyn Host, from: &str, target: &str) -> Option<String> {
    if !(target.starts_with("./") || target.starts_with("../") || target.starts_with('/')) {
        return None;
    }
    let resolved = path::resolve(path::dirname(from), target);
    if host.stat(&resolved, true) == Some(FileKind::File) {
        return Some(resolved);
    }
    // Like TypeScript, a target without an extension names a `.json`.
    let with_extension = format!("{resolved}.json");
    (host.stat(&with_extension, true) == Some(FileKind::File)).then_some(with_extension)
}

/// The resolution mode, if it's one which requires relative imports to carry
/// an extension.
///
/// Read from `module` rather than `moduleResolution`, because TypeScript
/// requires the two to agree: setting `module` to `node16` or `nodenext` and
/// `moduleResolution` to anything else is TS5109. `module` reaches us already
/// resolved through `extends`, so this is correct for a config which inherits
/// it.
fn module_resolution_mode(module: Option<&str>) -> Option<&'static str> {
    match module?.to_ascii_lowercase().as_str() {
        "node16" => Some("node16"),
        "nodenext" => Some("nodenext"),
        _ => None,
    }
}

/// `""` under `node16`/`nodenext`, which TypeScript reports as TS2835.
fn missing_extension(ts: &TsConfigSource, mode: &str) -> Diagnostic {
    let message = format!(
        "Grats will write imports with no file extension, but `{mode}` module resolution requires relative imports to have one, so the generated schema module will not type check. Set the Grats config option `importModuleSpecifierEnding` to `\".js\"`, which is the extension TypeScript expects in source even though the file is `.ts`."
    );
    Diagnostic {
        message_text: message,
        loc: grats_option_loc(ts, "importModuleSpecifierEnding"),
        related_information: related(
            ts,
            &["compilerOptions", "moduleResolution"],
            "`node16`/`nodenext` module resolution is set here",
        )
        .or_else(|| {
            related(
                ts,
                &["compilerOptions", "module"],
                "The module resolution mode follows `module`, set here",
            )
        }),
        fix: set_grats_option(ts, "importModuleSpecifierEnding", "\".js\"").map(Box::new),
    }
}

/// `.ts` without `allowImportingTsExtensions`, which TypeScript reports as
/// TS5097.
fn ts_extension_not_allowed(ts: &TsConfigSource, host: &dyn Host) -> Diagnostic {
    // `allowImportingTsExtensions` is itself only allowed when the project
    // doesn't emit (TS5096), so for a project which does emit the option to
    // reach for is `rewriteRelativeImportExtensions`, which carries no such
    // requirement and rewrites the `.ts` to `.js` on the way out.
    let emits = !["noEmit", "emitDeclarationOnly"]
        .iter()
        .any(|key| flag(host, ts.path, key) == Flag::On);
    let option = if emits {
        "rewriteRelativeImportExtensions"
    } else {
        "allowImportingTsExtensions"
    };
    let detail = if emits {
        " Enabling `rewriteRelativeImportExtensions` keeps the `.ts` in your source and has TypeScript rewrite it to `.js` on emit. `allowImportingTsExtensions` would also do, but only for a project which doesn't emit."
    } else {
        ""
    };
    Diagnostic {
        message_text: format!(
            "Grats will write imports ending in `.ts`, which TypeScript only accepts when `allowImportingTsExtensions` or `rewriteRelativeImportExtensions` is enabled.{detail}"
        ),
        loc: grats_option_loc(ts, "importModuleSpecifierEnding"),
        related_information: related(ts, &["compilerOptions"], "TypeScript is configured here"),
        fix: set_compiler_option(ts, option, "true").map(Box::new),
    }
}

/// The location of a Grats option's value, or of the `grats` object if the
/// option isn't written down, so the error lands on the config rather than
/// nowhere.
fn grats_option_loc(ts: &TsConfigSource, key: &str) -> Option<Location> {
    let span = ts
        .spans
        .value(&["grats", key])
        .or_else(|| ts.spans.key(&["grats"]))?;
    Some(Location {
        source: ts.source,
        start: ts.spans.to_utf16(ts.text, span.start),
        end: ts.spans.to_utf16(ts.text, span.end),
    })
}

fn related(
    ts: &TsConfigSource,
    path: &[&str],
    message: &str,
) -> Option<Vec<DiagnosticRelatedInformation>> {
    let span = ts.spans.key(path)?;
    Some(vec![DiagnosticRelatedInformation {
        message_text: message.to_string(),
        loc: Location {
            source: ts.source,
            start: ts.spans.to_utf16(ts.text, span.start),
            end: ts.spans.to_utf16(ts.text, span.end),
        },
    }])
}

/// A fix which sets a Grats option, replacing the value if it's already
/// written down and inserting the whole entry if it isn't.
fn set_grats_option(ts: &TsConfigSource, key: &str, value: &str) -> Option<CodeFixAction> {
    let change = ts.spans.set_member(ts.text, &["grats"], key, value)?;
    Some(CodeFixAction {
        fix_name: "setImportModuleSpecifierEnding".to_string(),
        description: format!("Set the Grats config option `{key}` to `{value}`"),
        changes: vec![FileTextChanges {
            file_name: ts.path.to_string(),
            text_changes: vec![TextChange {
                span: TextSpan {
                    start: ts.spans.to_utf16(ts.text, change.start),
                    length: ts.spans.to_utf16(ts.text, change.end)
                        - ts.spans.to_utf16(ts.text, change.start),
                },
                new_text: change.text,
            }],
        }],
    })
}

/// A fix which sets a TypeScript compiler option.
fn set_compiler_option(ts: &TsConfigSource, key: &str, value: &str) -> Option<CodeFixAction> {
    let change = ts
        .spans
        .set_member(ts.text, &["compilerOptions"], key, value)?;
    Some(CodeFixAction {
        fix_name: format!("set {key}"),
        description: format!("Set the TypeScript compiler option `{key}` to `{value}`"),
        changes: vec![FileTextChanges {
            file_name: ts.path.to_string(),
            text_changes: vec![TextChange {
                span: TextSpan {
                    start: ts.spans.to_utf16(ts.text, change.start),
                    length: ts.spans.to_utf16(ts.text, change.end)
                        - ts.spans.to_utf16(ts.text, change.start),
                },
                new_text: change.text,
            }],
        }],
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::host::DirEntries;
    use rustc_hash::FxHashMap;

    /// Just enough of a `Host` to read a handful of configs.
    struct Files(FxHashMap<String, String>);

    impl Files {
        fn new(files: &[(&str, &str)]) -> Self {
            Files(
                files
                    .iter()
                    .map(|(path, text)| (path.to_string(), text.to_string()))
                    .collect(),
            )
        }
    }

    impl Host for Files {
        fn read_file(&self, path: &str) -> Option<String> {
            self.0.get(path).cloned()
        }
        fn stat(&self, path: &str, _follow_links: bool) -> Option<FileKind> {
            self.0.contains_key(path).then_some(FileKind::File)
        }
        fn read_link(&self, _path: &str) -> Option<String> {
            None
        }
        fn realpath(&self, path: &str) -> Option<String> {
            Some(path.to_string())
        }
        fn read_dir(&self, _path: &str) -> Option<DirEntries> {
            None
        }
        fn current_directory(&self) -> String {
            "/p".to_string()
        }
        fn write_file(&self, _path: &str, _contents: &str) -> Result<(), String> {
            Ok(())
        }
        fn log(&self, _message: &str) {}
        fn log_error(&self, _message: &str) {}
    }

    const KEY: &str = "allowImportingTsExtensions";

    #[test]
    fn reads_the_option_from_the_config_itself() {
        let host = Files::new(&[(
            "/p/tsconfig.json",
            r#"{ "compilerOptions": { "allowImportingTsExtensions": true } }"#,
        )]);
        assert_eq!(flag(&host, "/p/tsconfig.json", KEY), Flag::On);
    }

    #[test]
    fn absent_everywhere_is_off() {
        let host = Files::new(&[("/p/tsconfig.json", r#"{ "compilerOptions": {} }"#)]);
        assert_eq!(flag(&host, "/p/tsconfig.json", KEY), Flag::Off);
    }

    #[test]
    fn follows_extends() {
        let host = Files::new(&[
            ("/p/tsconfig.json", r#"{ "extends": "./base.json" }"#),
            (
                "/p/base.json",
                r#"{ "compilerOptions": { "allowImportingTsExtensions": true } }"#,
            ),
        ]);
        assert_eq!(flag(&host, "/p/tsconfig.json", KEY), Flag::On);
    }

    #[test]
    fn extends_may_omit_the_json_extension() {
        let host = Files::new(&[
            ("/p/tsconfig.json", r#"{ "extends": "./base" }"#),
            (
                "/p/base.json",
                r#"{ "compilerOptions": { "allowImportingTsExtensions": true } }"#,
            ),
        ]);
        assert_eq!(flag(&host, "/p/tsconfig.json", KEY), Flag::On);
    }

    #[test]
    fn the_config_wins_over_the_one_it_extends() {
        let host = Files::new(&[
            (
                "/p/tsconfig.json",
                r#"{ "extends": "./base.json", "compilerOptions": { "allowImportingTsExtensions": false } }"#,
            ),
            (
                "/p/base.json",
                r#"{ "compilerOptions": { "allowImportingTsExtensions": true } }"#,
            ),
        ]);
        assert_eq!(flag(&host, "/p/tsconfig.json", KEY), Flag::Off);
    }

    #[test]
    fn the_last_entry_of_an_extends_array_wins() {
        let host = Files::new(&[
            (
                "/p/tsconfig.json",
                r#"{ "extends": ["./a.json", "./b.json"] }"#,
            ),
            (
                "/p/a.json",
                r#"{ "compilerOptions": { "allowImportingTsExtensions": true } }"#,
            ),
            (
                "/p/b.json",
                r#"{ "compilerOptions": { "allowImportingTsExtensions": false } }"#,
            ),
        ]);
        assert_eq!(flag(&host, "/p/tsconfig.json", KEY), Flag::Off);
    }

    #[test]
    fn a_package_specifier_is_unknown_rather_than_off() {
        // Resolving it would take module resolution. Reporting `Off` here
        // would be a false error for a project which sets the option in the
        // config it extends.
        let host = Files::new(&[(
            "/p/tsconfig.json",
            r#"{ "extends": "@tsconfig/node20/tsconfig.json" }"#,
        )]);
        assert_eq!(flag(&host, "/p/tsconfig.json", KEY), Flag::Unknown);
    }

    #[test]
    fn a_missing_config_is_unknown() {
        let host = Files::new(&[("/p/tsconfig.json", r#"{ "extends": "./gone.json" }"#)]);
        assert_eq!(flag(&host, "/p/tsconfig.json", KEY), Flag::Unknown);
    }

    #[test]
    fn a_cycle_terminates() {
        let host = Files::new(&[
            ("/p/tsconfig.json", r#"{ "extends": "./other.json" }"#),
            ("/p/other.json", r#"{ "extends": "./tsconfig.json" }"#),
        ]);
        assert_eq!(flag(&host, "/p/tsconfig.json", KEY), Flag::Unknown);
    }

    #[test]
    fn module_pins_the_resolution_mode() {
        assert_eq!(module_resolution_mode(Some("nodenext")), Some("nodenext"));
        assert_eq!(module_resolution_mode(Some("NodeNext")), Some("nodenext"));
        assert_eq!(module_resolution_mode(Some("node16")), Some("node16"));
        assert_eq!(module_resolution_mode(Some("esnext")), None);
        assert_eq!(module_resolution_mode(Some("commonjs")), None);
        assert_eq!(module_resolution_mode(None), None);
    }
}
