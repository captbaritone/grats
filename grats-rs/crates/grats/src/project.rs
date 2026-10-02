//! Finds and reads a project's `tsconfig.json`. `oxc_resolver` reads the
//! config, following `extends`, and we list the files it includes like
//! TypeScript's `matchFiles`.
//!
//! Differences from TypeScript:
//!
//! - Only what Grats uses is read: `files`, `include`, `exclude`, `allowJs`
//!   and `checkJs`, `outDir` and `declarationDir`, the `paths`, `baseUrl` and
//!   `rootDirs` which imports resolve with (see `crate::program`), and the
//!   `grats` key. Nothing else is validated, so errors elsewhere in the
//!   config aren't reported, and neither is a config which includes no
//!   files.
//! - `files`, `include` and `exclude` inherited through `extends` are
//!   relative to the extending config's directory rather than the extended
//!   config's.
//! - Patterns are matched with `fast_glob`, case sensitively, which also
//!   supports `[...]` and `{a,b}`. Below the directory a pattern starts
//!   from, files and directories whose names start with `.` are skipped,
//!   as are `node_modules`, `bower_components` and `jspm_packages`, even
//!   where a pattern names them.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use oxc_resolver::{ResolveError, ResolveOptions, ResolverGeneric, TsConfig};
use serde::Serialize;
use serde_json::Value;

use crate::errors::ts_config_not_found;
use crate::grats_config::{GratsConfig, validate_grats_options};
use crate::host::{FileKind, Host};
use crate::program::{HostFileSystem, ProgramOptions};
use crate::utils::diagnostic_error::{DiagnosticsResult, locationless_err};
use crate::utils::path;

/// A project, as its `tsconfig.json` describes it.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    /// The path of the `tsconfig.json`.
    pub config_path: String,
    /// The validated Grats config.
    pub config: GratsConfig,
    /// Warnings about the Grats config.
    pub warnings: Vec<String>,
    pub program: ProgramOptions,
}

const PACKAGE_FOLDERS: [&str; 3] = ["node_modules", "bower_components", "jspm_packages"];

/// The extensions of the files a pattern may match, in groups of files
/// which TypeScript considers the same file, each in order of priority.
const EXTENSION_GROUPS: [&[&str]; 3] = [
    &[".ts", ".tsx", ".d.ts", ".js", ".jsx"],
    &[".cts", ".d.cts", ".cjs"],
    &[".mts", ".d.mts", ".mjs"],
];

/// Reads the project described by the `tsconfig.json` at `config_path`, or
/// if it's `None`, the one found in the current directory or the closest
/// directory above it.
pub fn load_project(
    config_path: Option<&str>,
    use_case_sensitive_file_names: bool,
    host: Arc<dyn Host>,
) -> DiagnosticsResult<Project> {
    let config_path = match config_path {
        Some(config_path) => config_path.to_string(),
        None => find_config_file(&*host).ok_or_else(|| {
            let cwd = host.current_directory();
            vec![locationless_err(ts_config_not_found(path::to_native(&cwd)))]
        })?,
    };
    let config_path = config_path.as_str();
    let resolver = ResolverGeneric::new_with_file_system(
        HostFileSystem {
            host: Arc::clone(&host),
        },
        ResolveOptions::default(),
    );
    let tsconfig = resolver
        .resolve_tsconfig(path::to_std(config_path))
        .map_err(|error| {
            // serde_json's message for invalid JSON, rather than `JSONError`'s
            // `Debug` output.
            let message = match &error {
                ResolveError::TsconfigLoadFailed { source, .. } => match &**source {
                    ResolveError::Json(json) => json.message.clone(),
                    _ => error.to_string(),
                },
                _ => error.to_string(),
            };
            vec![locationless_err(format!(
                "Grats: Could not read `{config_path}`: {message}"
            ))]
        })?;
    let tsconfig_path = path::from_std(tsconfig.path());

    // The `grats` key of the config itself, which isn't inherited.
    let raw = host.read_file(&tsconfig_path).and_then(|mut text| {
        json_strip_comments::strip(&mut text).ok()?;
        serde_json::from_str::<Value>(&text).ok()
    });
    let validated = validate_grats_options(raw.as_ref().and_then(|raw| raw.get("grats")))
        .map_err(|message| vec![locationless_err(message)])?;

    // Like `getAllowJSCompilerOption`.
    let options = &tsconfig.compiler_options;
    let allow_js = options.allow_js.or(options.check_js).unwrap_or(false);
    Ok(Project {
        config_path: config_path.to_string(),
        config: validated.config,
        warnings: validated.warnings,
        program: ProgramOptions {
            root_names: root_names(&tsconfig, allow_js, &*host),
            allow_js,
            tsconfig: Some(tsconfig_path),
            use_case_sensitive_file_names,
        },
    })
}

/// Like `ts.findConfigFile`: the first `tsconfig.json` in the current
/// directory or a directory above it.
fn find_config_file(host: &dyn Host) -> Option<String> {
    let mut directory = host.current_directory();
    loop {
        let candidate = path::resolve(&directory, "tsconfig.json");
        if host.stat(&candidate, true) == Some(FileKind::File) {
            return Some(candidate);
        }
        let parent = path::dirname(&directory).to_string();
        if parent == directory {
            return None;
        }
        directory = parent;
    }
}

/// Like `getFileNamesFromConfigSpecs`: the files named by `files`, followed
/// by the files `include` matches and `exclude` doesn't.
fn root_names(tsconfig: &TsConfig, allow_js: bool, host: &dyn Host) -> Vec<String> {
    let path = |path: &std::path::PathBuf| path::from_std(path);
    let directory = path::from_std(tsconfig.directory());
    let files: Vec<String> = tsconfig.files.iter().flatten().map(path).collect();
    let includes: Vec<String> = match &tsconfig.include {
        Some(include) => include.iter().map(path).map(implicit_glob).collect(),
        None if tsconfig.files.is_some() => Vec::new(),
        None => vec![format!("{directory}/**/*")],
    };
    let excludes: Vec<String> = match &tsconfig.exclude {
        Some(exclude) => exclude.iter().map(path).collect(),
        None => PACKAGE_FOLDERS
            .iter()
            .map(|folder| format!("{directory}/{folder}"))
            .chain(tsconfig.compiler_options.out_dir.iter().map(path))
            .chain(tsconfig.compiler_options.declaration_dir.iter().map(path))
            .collect(),
    };

    let mut matcher = Matcher {
        host,
        allow_js,
        includes: &includes,
        excludes: &excludes,
        visited: HashSet::new(),
        matched: Vec::new(),
    };
    let mut bases: Vec<&str> = includes.iter().map(|include| base_path(include)).collect();
    // Parent directories first, so that the directories within them aren't
    // walked again.
    bases.sort();
    bases.dedup();
    for base in bases {
        matcher.walk(base);
    }

    // Like `hasFileWithHigherPriorityExtension`: leave out matched files
    // when the same file with an extension of higher priority is named by
    // `files` or matched.
    let mut priorities: HashMap<(&str, usize), usize> = HashMap::new();
    for file in files.iter().chain(&matcher.matched) {
        if let Some((stem, group, priority)) = split_extension(file) {
            let best = priorities.entry((stem, group)).or_insert(priority);
            *best = (*best).min(priority);
        }
    }
    let literal: HashSet<&str> = files.iter().map(String::as_str).collect();
    let wildcard = matcher.matched.iter().filter(|file| {
        !literal.contains(file.as_str())
            && split_extension(file)
                .is_none_or(|(stem, group, priority)| priorities[&(stem, group)] == priority)
    });
    files.iter().chain(wildcard).cloned().collect()
}

/// A pattern whose last component has no extension or wildcard names a
/// directory, whose files it matches.
fn implicit_glob(pattern: String) -> String {
    let last = pattern.rsplit('/').next().unwrap_or(&pattern);
    if last.contains(['.', '*', '?']) {
        pattern
    } else {
        format!("{}/**/*", pattern.trim_end_matches('/'))
    }
}

/// The directory the files a pattern matches are found in: its components
/// before the first with a wildcard.
fn base_path(pattern: &str) -> &str {
    let wildcard = pattern.find(['*', '?', '[', '{']).unwrap_or(pattern.len());
    let end = pattern[..wildcard].rfind('/').unwrap_or(0);
    if end == 0 { "/" } else { &pattern[..end] }
}

struct Matcher<'m> {
    host: &'m dyn Host,
    allow_js: bool,
    includes: &'m [String],
    excludes: &'m [String],
    /// The real paths of the directories walked so far.
    visited: HashSet<String>,
    matched: Vec<String>,
}

impl Matcher<'_> {
    /// Adds the matching files in `directory` and the directories within it,
    /// the files of each directory before its subdirectories.
    fn walk(&mut self, directory: &str) {
        let real_path = self
            .host
            .realpath(directory)
            .unwrap_or_else(|| directory.to_string());
        if !self.visited.insert(real_path) {
            return;
        }
        let Some(entries) = self.host.read_dir(directory) else {
            return;
        };
        let join = |name: &str| {
            if directory.ends_with('/') {
                format!("{directory}{name}")
            } else {
                format!("{directory}/{name}")
            }
        };
        for name in &entries.files {
            let path = join(name);
            if !name.starts_with('.')
                && split_extension(&path).is_some_and(|(_, group, priority)| {
                    self.allow_js || EXTENSION_GROUPS[group][priority].contains("ts")
                })
                && self
                    .includes
                    .iter()
                    .any(|include| fast_glob::glob_match(include, &path))
                && !self.is_excluded(&path)
            {
                self.matched.push(path);
            }
        }
        for name in &entries.directories {
            let path = join(name);
            if !name.starts_with('.')
                && !PACKAGE_FOLDERS.contains(&name.as_str())
                && self
                    .includes
                    .iter()
                    .any(|include| may_match_within(include, &path))
                && !self.is_excluded(&path)
            {
                self.walk(&path);
            }
        }
    }

    /// Whether an `exclude` pattern matches `path`, or a directory it's in.
    fn is_excluded(&self, path: &str) -> bool {
        self.excludes
            .iter()
            .any(|exclude| fast_glob::glob_match(exclude, path))
    }
}

/// Whether `pattern` may match files within `directory`.
fn may_match_within(pattern: &str, directory: &str) -> bool {
    let mut pattern_components = pattern.split('/');
    for component in directory.split('/') {
        match pattern_components.next() {
            Some("**") => return true,
            Some(pattern_component) if fast_glob::glob_match(pattern_component, component) => {}
            _ => return false,
        }
    }
    // The last component matches files.
    pattern_components.count() > 1
}

/// A file a pattern may match, split into its path without its extension,
/// and its extension's group and priority (see `EXTENSION_GROUPS`).
fn split_extension(path: &str) -> Option<(&str, usize, usize)> {
    EXTENSION_GROUPS
        .iter()
        .enumerate()
        .flat_map(|(group, extensions)| {
            extensions
                .iter()
                .enumerate()
                .map(move |(priority, extension)| (group, priority, extension))
        })
        .filter(|(_, _, extension)| path.ends_with(*extension))
        .max_by_key(|(_, _, extension)| extension.len())
        .map(|(group, priority, extension)| {
            (&path[..path.len() - extension.len()], group, priority)
        })
}
