//! PORT: Replaces `ts.createProgram`, which found the files of the program,
//! and `src/gratsSourceFiles.ts`, which picked the files to extract GraphQL
//! definitions from. The TypeScript side parses `tsconfig.json` and sends the
//! options which matter here (see `rustProgramOptions` in `src/rs/host.ts`).
//!
//! The files are the root files and every file they import, found by
//! following `import` and `export ... from` declarations and `import =`,
//! resolved with `oxc_resolver`'s `resolve_dts`. Files are listed after the
//! files they import. This is what Grats needs: the files which may define
//! GraphQL types (including the declarations of Grats' built-in types, such
//! as `Int`, in the `grats` package), and how their imports resolve.
//!
//! It isn't all of the files TypeScript's program has. Differences:
//!
//! - TypeScript's library files, packages included by default (`@types`)
//!   and files named by `/// <reference>` directives aren't included, so
//!   their global declarations (such as `Date`) aren't known. Neither are
//!   JSON files, or the modules which `import()`, `require()`, import types,
//!   JSX and emit helpers import.
//! - Imports within namespaces and `declare module "x"` blocks aren't
//!   followed. JavaScript files are followed only with `allowJs`, and never
//!   in `node_modules`.
//! - Whether a file is a module is decided from its top-level statements
//!   and its format (`moduleDetection`), without looking for `import.meta`
//!   or JSX.
//! - Every `moduleResolution` uses the bundler algorithm, with conditions
//!   for the importing file's format. `rootDirs`, `typesVersions` ranges,
//!   `types@<range>` conditions and falling through to the next condition
//!   of `exports` or `imports` aren't supported, and `node10` still reads
//!   `exports` and `imports`. A package's imports of its own name and its
//!   `#imports` don't map JavaScript files to their declaration files, and
//!   packages naming only JavaScript files don't fall back to `@types`.
//!   Packages installed twice aren't redirected to one copy.

use std::cell::OnceCell;
use std::collections::{HashMap, HashSet};
use std::io;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::Arc;

use oxc_ast::ast::{
    BindingPattern, Declaration, ImportAttributeKey, Program as AstProgram, Statement,
    TSModuleReference, WithClause,
};
use oxc_resolver::{FileMetadata, FileSystem, ResolveError, ResolveOptions, ResolverGeneric};
use oxc_span::SourceType;
use serde::Deserialize;

use crate::files::{Files, ParsedFile};
use crate::host::{FileKind, Host};
use crate::utils::path;

/// The compiler options which decide the files of the program, as computed
/// by TypeScript. Enums have the values of TypeScript's enums.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramOptions {
    pub root_names: Vec<String>,
    /// `getEmitModuleResolutionKind`.
    pub module_resolution: u32,
    /// `getEmitModuleDetectionKind`.
    pub module_detection: u32,
    pub allow_js: bool,
    pub custom_conditions: Vec<String>,
    /// The patterns of the `paths` option and their substitutions, in order.
    pub paths: Option<Vec<(String, Vec<String>)>>,
    /// The directory which `paths` substitutions are relative to.
    pub paths_base_path: Option<String>,
    pub base_url: Option<String>,
    pub preserve_symlinks: bool,
    pub use_case_sensitive_file_names: bool,
}

// `ModuleResolutionKind`
const MODULE_RESOLUTION_NODE10: u32 = 2;
const MODULE_RESOLUTION_NODE16: u32 = 3;
const MODULE_RESOLUTION_NODE_NEXT: u32 = 99;
const MODULE_RESOLUTION_BUNDLER: u32 = 100;
// `ModuleDetectionKind`
const MODULE_DETECTION_LEGACY: u32 = 1;
const MODULE_DETECTION_FORCE: u32 = 3;

impl ProgramOptions {
    fn is_node16_or_node_next(&self) -> bool {
        (MODULE_RESOLUTION_NODE16..=MODULE_RESOLUTION_NODE_NEXT).contains(&self.module_resolution)
    }
}

/// A module format, which TypeScript represents as `ModuleKind.CommonJS` and
/// `ModuleKind.ESNext`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum Mode {
    CommonJs,
    Esm,
}

/// The program's files, and how their imports resolve.
pub struct Program<'a> {
    files: &'a Files<'a>,
    source_files: Vec<Rc<ParsedFile<'a>>>,
    /// The path each module specifier resolved to, by the key of the file
    /// which imports it.
    resolutions: HashMap<String, HashMap<String, Option<String>>>,
    /// The files which may declare each name in the global scope. Built the
    /// first time it's needed.
    global_index: OnceCell<HashMap<String, Vec<Rc<ParsedFile<'a>>>>>,
}

impl<'a> Program<'a> {
    pub fn new(files: &'a Files<'a>, host: Arc<dyn Host>, options: ProgramOptions) -> Self {
        let mut builder = Builder::new(files, host, &options);
        for root_name in &options.root_names {
            builder.add_root(root_name);
        }
        Program {
            files,
            source_files: builder.source_files,
            resolutions: builder.resolutions,
            global_index: OnceCell::new(),
        }
    }

    /// The files of the program, like `program.getSourceFiles()`.
    pub fn source_files(&self) -> &[Rc<ParsedFile<'a>>] {
        &self.source_files
    }

    /// Ported from `gratsSourceFilesFromProgram` in `src/gratsSourceFiles.ts`:
    /// the files to extract GraphQL definitions from.
    pub fn grats_source_files(&self) -> Vec<Rc<ParsedFile<'a>>> {
        // If the file doesn't contain any GraphQL definitions, skip it.
        // PORT: TypeScript tests `/@(gql)|(killsParentOnException)/i`.
        self.source_files
            .iter()
            .filter(|file| {
                contains_ignore_ascii_case(file.text, "@gql")
                    || contains_ignore_ascii_case(file.text, "killsParentOnException")
            })
            .cloned()
            .collect()
    }

    /// The file of the program which `specifier` resolves to when imported
    /// by `file`.
    pub fn resolve_module(
        &self,
        file: &ParsedFile<'a>,
        specifier: &str,
    ) -> Option<Rc<ParsedFile<'a>>> {
        let path = self
            .resolutions
            .get(&self.files.key(&file.path))?
            .get(specifier)?
            .as_ref()?;
        self.files.file(path)
    }

    /// The files which may declare `name` in the global scope, in the order
    /// in which the checker merges their declarations: files which aren't
    /// modules (including library files), followed by modules with
    /// `declare global` blocks.
    pub fn global_files(&self, name: &str) -> &[Rc<ParsedFile<'a>>] {
        self.global_index
            .get_or_init(|| self.index_global_files())
            .get(name)
            .map_or(&[], Vec::as_slice)
    }

    fn index_global_files(&self) -> HashMap<String, Vec<Rc<ParsedFile<'a>>>> {
        let mut index: HashMap<String, Vec<Rc<ParsedFile<'a>>>> = HashMap::new();
        let mut add = |file: &Rc<ParsedFile<'a>>, names: HashSet<&str>| {
            for name in names {
                index
                    .entry(name.to_string())
                    .or_default()
                    .push(Rc::clone(file));
            }
        };
        for file in &self.source_files {
            if !file.is_module {
                add(file, declared_names(&file.program.body));
            }
        }
        for file in &self.source_files {
            if file.is_module {
                let mut names = HashSet::new();
                for statement in &file.program.body {
                    if let Statement::TSGlobalDeclaration(global) = statement {
                        names.extend(declared_names(&global.body.body));
                    }
                }
                add(file, names);
            }
        }
        index
    }
}

/// The names which `statements` declare in their scope.
fn declared_names<'s>(statements: &'s [Statement]) -> HashSet<&'s str> {
    let mut names = HashSet::new();
    for statement in statements {
        let declaration = match statement {
            Statement::ExportDeclaration(export) => &export.declaration,
            _ => match statement.as_declaration() {
                Some(declaration) => declaration,
                None => continue,
            },
        };
        match declaration {
            Declaration::VariableDeclaration(declaration) => {
                for declarator in &declaration.declarations {
                    if let BindingPattern::BindingIdentifier(id) = &declarator.id {
                        names.insert(id.name.as_str());
                    }
                }
            }
            Declaration::FunctionDeclaration(function) => {
                names.extend(function.id.as_ref().map(|id| id.name.as_str()));
            }
            Declaration::ClassDeclaration(class) => {
                names.extend(class.id.as_ref().map(|id| id.name.as_str()));
            }
            Declaration::TSTypeAliasDeclaration(declaration) => {
                names.insert(declaration.id.name.as_str());
            }
            Declaration::TSInterfaceDeclaration(declaration) => {
                names.insert(declaration.id.name.as_str());
            }
            Declaration::TSEnumDeclaration(declaration) => {
                names.insert(declaration.id.name.as_str());
            }
            Declaration::TSNamespaceDeclaration(declaration) => {
                names.insert(declaration.id.name.as_str());
            }
            Declaration::TSImportEqualsDeclaration(declaration) => {
                names.insert(declaration.id.name.as_str());
            }
            Declaration::TSExternalModuleDeclaration(_) | Declaration::TSGlobalDeclaration(_) => {}
        }
    }
    names
}

/// A file, and the modules it imports.
struct Scanned<'a> {
    file: Rc<ParsedFile<'a>>,
    imports: Vec<Import>,
}

struct Import {
    specifier: String,
    /// The mode the import is resolved in (`getModeForUsageLocation`).
    mode: Option<Mode>,
}

struct Builder<'p, 'a> {
    files: &'a Files<'a>,
    host: Arc<dyn Host>,
    options: &'p ProgramOptions,
    resolvers: Resolvers,
    /// The keys of the files the walk has come across.
    visited: HashSet<String>,
    source_files: Vec<Rc<ParsedFile<'a>>>,
    resolutions: HashMap<String, HashMap<String, Option<String>>>,
    /// By the containing directory, specifier and mode.
    module_resolutions: HashMap<(String, String, Option<Mode>), Option<String>>,
    /// The `type` of the `package.json` which applies to a file, by
    /// directory.
    package_types: HashMap<String, Option<String>>,
}

impl<'p, 'a> Builder<'p, 'a> {
    fn new(files: &'a Files<'a>, host: Arc<dyn Host>, options: &'p ProgramOptions) -> Self {
        Builder {
            files,
            resolvers: Resolvers::new(Arc::clone(&host), options),
            host,
            options,
            visited: HashSet::new(),
            source_files: Vec::new(),
            resolutions: HashMap::new(),
            module_resolutions: HashMap::new(),
            package_types: HashMap::new(),
        }
    }

    /// Adds a root file and the files it imports, each after the files it
    /// imports. The walk keeps a stack rather than recursing, since import
    /// chains can be long.
    fn add_root(&mut self, path: &str) {
        let Some(root) = self.visit(path) else {
            return;
        };
        let mut stack = vec![(root, 0)];
        while let Some((file, index)) = stack.last_mut() {
            let Some(import) = file.imports.get(*index) else {
                let (file, _) = stack.pop().expect("The stack isn't empty");
                self.source_files.push(Rc::clone(&file.file));
                continue;
            };
            *index += 1;
            let file = Rc::clone(file);
            let resolved =
                self.resolve_module_name(&file.file.path, &import.specifier, import.mode);
            self.resolutions
                .entry(self.files.key(&file.file.path))
                .or_default()
                .entry(import.specifier.clone())
                .or_insert_with(|| resolved.clone());
            let Some(path) = resolved else {
                continue;
            };
            let is_js = !ends_with_any(&path, &TS_EXTENSIONS);
            if is_js && (!self.options.allow_js || path.contains("/node_modules/")) {
                continue;
            }
            if let Some(imported) = self.visit(&path) {
                stack.push((imported, 0));
            }
        }
    }

    /// Loads the file at `path`, unless the walk has come across it already.
    fn visit(&mut self, path: &str) -> Option<Rc<Scanned<'a>>> {
        if !self.visited.insert(self.files.key(path)) {
            return None;
        }
        let options = self.options;
        let format = self.implied_format(path);
        let mut imports = None;
        let file = self.files.load(path, |program, source_type| {
            let (file_imports, is_module) = scan_file(program, source_type, path, format, options);
            imports = Some(file_imports);
            is_module
        })?;
        Some(Rc::new(Scanned {
            file,
            imports: imports.expect("Files should only be loaded by the program"),
        }))
    }

    /// Like `getImpliedNodeFormatForFile`, under `node16` and `nodenext`.
    fn implied_format(&mut self, path: &str) -> Option<Mode> {
        if ends_with_any(path, &[".d.mts", ".mts", ".mjs"]) {
            Some(Mode::Esm)
        } else if ends_with_any(path, &[".d.cts", ".cts", ".cjs"]) {
            Some(Mode::CommonJs)
        } else if self.options.is_node16_or_node_next() {
            let package_type = self.package_type(path::dirname(path));
            Some(if package_type.as_deref() == Some("module") {
                Mode::Esm
            } else {
                Mode::CommonJs
            })
        } else {
            None
        }
    }

    /// The `type` of the nearest `package.json`, like
    /// `getPackageScopeForPath`.
    fn package_type(&mut self, directory: &str) -> Option<String> {
        let mut directories = Vec::new();
        let mut directory = directory.to_string();
        let package_type = loop {
            if let Some(package_type) = self.package_types.get(&directory) {
                break package_type.clone();
            }
            directories.push(directory.clone());
            if basename(&directory) != "node_modules"
                && let Some(text) = self.host.read_file(&join(&directory, "package.json"))
            {
                let json: serde_json::Value =
                    serde_json::from_str(&text).unwrap_or(serde_json::Value::Null);
                break json
                    .get("type")
                    .and_then(|value| value.as_str())
                    .map(str::to_string);
            }
            let parent = path::dirname(&directory);
            if parent == directory {
                break None;
            }
            directory = parent.to_string();
        };
        for directory in directories {
            self.package_types.insert(directory, package_type.clone());
        }
        package_type
    }

    /// Like `resolveModuleName`.
    fn resolve_module_name(
        &mut self,
        containing_file: &str,
        specifier: &str,
        mode: Option<Mode>,
    ) -> Option<String> {
        let directory = path::dirname(containing_file).to_string();
        let cache_key = (directory, specifier.to_string(), mode);
        if let Some(resolved) = self.module_resolutions.get(&cache_key) {
            return resolved.clone();
        }
        let resolved = self.resolve_module_name_uncached(containing_file, specifier, mode);
        self.module_resolutions.insert(cache_key, resolved.clone());
        resolved
    }

    fn resolve_module_name_uncached(
        &self,
        containing_file: &str,
        specifier: &str,
        mode: Option<Mode>,
    ) -> Option<String> {
        let options = self.options;
        let index = mode_index(mode);

        // Like `tryLoadModuleUsingOptionalResolutionSettings`.
        let mut candidates = Vec::new();
        if let (Some(paths), false) = (&options.paths, path_is_relative(specifier)) {
            let base_path = options.paths_base_path.as_deref().unwrap_or("/");
            if let Some((substitutions, star)) = match_paths_pattern(paths, specifier) {
                for substitution in substitutions {
                    let substitution = match star {
                        Some(star) => substitution.replacen('*', star, 1),
                        None => substitution.clone(),
                    };
                    candidates.push(path::resolve(base_path, &substitution));
                }
            }
        }
        if !is_external_module_name_relative(specifier)
            && let Some(base_url) = &options.base_url
        {
            candidates.push(path::resolve(base_url, specifier));
        }
        for candidate in candidates {
            if let Some(path) = resolve_dts(
                &self.resolvers.no_realpath[index],
                containing_file,
                &candidate,
            ) {
                // Files found in `node_modules` are known by their real path.
                return Some(
                    if path.contains("/node_modules/") && !options.preserve_symlinks {
                        self.host.realpath(&path).unwrap_or(path)
                    } else {
                        path
                    },
                );
            }
        }

        // Relative imports and `#imports` don't follow symbolic links.
        let resolvers = if is_external_module_name_relative(specifier) || specifier.starts_with('#')
        {
            &self.resolvers.no_realpath
        } else {
            &self.resolvers.realpath
        };
        resolve_dts(&resolvers[index], containing_file, specifier)
    }
}

/// Scans a file for the modules it imports. Returns them and whether the
/// file is a module.
fn scan_file(
    program: &AstProgram,
    source_type: SourceType,
    path: &str,
    implied_format: Option<Mode>,
    options: &ProgramOptions,
) -> (Vec<Import>, bool) {
    let is_declaration_file = source_type.is_typescript_definition();

    // Like `setExternalModuleIndicator`.
    let has_module_syntax = program.body.iter().any(is_external_module_indicator);
    let is_module = match options.module_detection {
        MODULE_DETECTION_FORCE => has_module_syntax || !is_declaration_file,
        MODULE_DETECTION_LEGACY => has_module_syntax,
        _ => {
            has_module_syntax
                || (!is_declaration_file
                    && (implied_format == Some(Mode::Esm)
                        || ends_with_any(path, &[".cjs", ".cts", ".mjs", ".mts"])))
        }
    };

    let imports = program
        .body
        .iter()
        .filter_map(|statement| {
            let (specifier, override_mode, is_import_equals) = module_reference(statement)?;
            let mode = override_mode.or_else(|| {
                // Like `getModeForUsageLocation`.
                if options.module_resolution == MODULE_RESOLUTION_NODE10 {
                    None
                } else if is_import_equals {
                    Some(Mode::CommonJs)
                } else if options.is_node16_or_node_next() {
                    implied_format
                } else {
                    Some(Mode::Esm)
                }
            });
            Some(Import {
                specifier: specifier.to_string(),
                mode,
            })
        })
        .collect();
    (imports, is_module)
}

/// Like `isAnExternalModuleIndicatorNode`.
fn is_external_module_indicator(statement: &Statement) -> bool {
    match statement {
        Statement::ImportDeclaration(_)
        | Statement::ExportAllDeclaration(_)
        | Statement::ExportDefaultDeclaration(_)
        | Statement::ExportDeclaration(_)
        | Statement::ExportNamedDeclaration(_)
        | Statement::ExportFromDeclaration(_)
        | Statement::TSExportAssignment(_) => true,
        Statement::TSImportEqualsDeclaration(declaration) => matches!(
            declaration.module_reference,
            TSModuleReference::ExternalModuleReference(_)
        ),
        _ => false,
    }
}

/// The module a statement imports, if any: its specifier, the
/// `resolution-mode` of a type-only import, and whether it's `import =`.
fn module_reference<'s>(statement: &'s Statement) -> Option<(&'s str, Option<Mode>, bool)> {
    let declaration =
        |source: &'s str, type_only: bool, with_clause: &Option<oxc_allocator::Box<WithClause>>| {
            let override_mode = if type_only {
                with_clause.as_deref().and_then(resolution_mode_override)
            } else {
                None
            };
            Some((source, override_mode, false))
        };
    let (specifier, override_mode, is_import_equals) = match statement {
        Statement::ImportDeclaration(import) => declaration(
            import.source.value.as_str(),
            import.import_kind.is_type(),
            &import.with_clause,
        )?,
        Statement::ExportFromDeclaration(export) => declaration(
            export.source.value.as_str(),
            export.export_kind.is_type(),
            &export.with_clause,
        )?,
        Statement::ExportAllDeclaration(export) => declaration(
            export.source.value.as_str(),
            export.export_kind.is_type(),
            &export.with_clause,
        )?,
        Statement::TSImportEqualsDeclaration(import) => (
            external_module_reference(&import.module_reference)?,
            None,
            true,
        ),
        Statement::ExportDeclaration(export) => match &export.declaration {
            Declaration::TSImportEqualsDeclaration(import) => (
                external_module_reference(&import.module_reference)?,
                None,
                true,
            ),
            _ => return None,
        },
        _ => return None,
    };
    (!specifier.is_empty()).then_some((specifier, override_mode, is_import_equals))
}

/// The specifier of `import x = require("...")`.
fn external_module_reference<'s>(reference: &'s TSModuleReference) -> Option<&'s str> {
    match reference {
        TSModuleReference::ExternalModuleReference(reference) => {
            Some(reference.expression.value.as_str())
        }
        _ => None,
    }
}

/// Like `getResolutionModeOverride`.
fn resolution_mode_override(with_clause: &WithClause) -> Option<Mode> {
    let [attribute] = with_clause.with_entries.as_slice() else {
        return None;
    };
    let ImportAttributeKey::StringLiteral(key) = &attribute.key else {
        return None;
    };
    if key.value.as_str() != "resolution-mode" {
        return None;
    }
    match attribute.value.value.as_str() {
        "import" => Some(Mode::Esm),
        "require" => Some(Mode::CommonJs),
        _ => None,
    }
}

/// Answers `oxc_resolver`'s file system calls through the host.
struct HostFileSystem {
    host: Arc<dyn Host>,
}

impl HostFileSystem {
    fn stat(&self, path: &Path, follow_links: bool) -> io::Result<FileMetadata> {
        let kind = self
            .host
            .stat(&path.to_string_lossy(), follow_links)
            .ok_or_else(not_found)?;
        Ok(FileMetadata::new(
            kind == FileKind::File,
            kind == FileKind::Directory,
            kind == FileKind::Symlink,
        ))
    }
}

fn not_found() -> io::Error {
    io::Error::from(io::ErrorKind::NotFound)
}

impl FileSystem for HostFileSystem {
    fn new() -> Self {
        unreachable!("Resolvers are created with a host");
    }

    fn read(&self, path: &Path) -> io::Result<Vec<u8>> {
        self.read_to_string(path).map(String::into_bytes)
    }

    fn read_to_string(&self, path: &Path) -> io::Result<String> {
        self.host
            .read_file(&path.to_string_lossy())
            .ok_or_else(not_found)
    }

    fn metadata(&self, path: &Path) -> io::Result<FileMetadata> {
        self.stat(path, true)
    }

    fn symlink_metadata(&self, path: &Path) -> io::Result<FileMetadata> {
        self.stat(path, false)
    }

    fn read_link(&self, path: &Path) -> Result<PathBuf, ResolveError> {
        self.host
            .read_link(&path.to_string_lossy())
            .map(PathBuf::from)
            .ok_or_else(|| ResolveError::from(not_found()))
    }

    fn canonicalize(&self, path: &Path) -> io::Result<PathBuf> {
        self.host
            .realpath(&path.to_string_lossy())
            .map(PathBuf::from)
            .ok_or_else(not_found)
    }
}

/// The resolvers for each mode (see `mode_index`), which share a cache.
struct Resolvers {
    /// Follow symbolic links to the files they find, unless
    /// `preserveSymlinks`. TypeScript does for files found in `node_modules`.
    realpath: [ResolverGeneric<HostFileSystem>; 3],
    /// Don't follow symbolic links to the files they find, as TypeScript
    /// doesn't for relative imports.
    no_realpath: [ResolverGeneric<HostFileSystem>; 3],
}

impl Resolvers {
    fn new(host: Arc<dyn Host>, options: &ProgramOptions) -> Self {
        let resolve_options = |mode, symlinks| ResolveOptions {
            condition_names: conditions(options, mode),
            symlinks,
            node_path: false,
            ..ResolveOptions::default()
        };
        let modes = [Some(Mode::Esm), Some(Mode::CommonJs), None];
        let resolver = ResolverGeneric::new_with_file_system(
            HostFileSystem { host },
            resolve_options(None, false),
        );
        Resolvers {
            realpath: modes.map(|mode| {
                resolver.clone_with_options(resolve_options(mode, !options.preserve_symlinks))
            }),
            no_realpath: modes
                .map(|mode| resolver.clone_with_options(resolve_options(mode, false))),
        }
    }
}

fn mode_index(mode: Option<Mode>) -> usize {
    match mode {
        Some(Mode::Esm) => 0,
        Some(Mode::CommonJs) => 1,
        None => 2,
    }
}

/// Like `getConditions`.
fn conditions(options: &ProgramOptions, mode: Option<Mode>) -> Vec<String> {
    let module_resolution = options.module_resolution;
    let mode = match mode {
        None if module_resolution == MODULE_RESOLUTION_BUNDLER => Some(Mode::Esm),
        None if module_resolution == MODULE_RESOLUTION_NODE10 => return Vec::new(),
        mode => mode,
    };
    let mut conditions = vec![if mode == Some(Mode::Esm) {
        "import".to_string()
    } else {
        "require".to_string()
    }];
    conditions.push("types".to_string());
    if module_resolution != MODULE_RESOLUTION_BUNDLER {
        conditions.push("node".to_string());
    }
    conditions.extend(options.custom_conditions.iter().cloned());
    conditions
}

/// The file `specifier` resolves to from `containing_file`, if it's a
/// TypeScript or JavaScript file.
fn resolve_dts(
    resolver: &ResolverGeneric<HostFileSystem>,
    containing_file: &str,
    specifier: &str,
) -> Option<String> {
    let resolution = resolver.resolve_dts(containing_file, specifier).ok()?;
    let path = resolution.into_path_buf().to_string_lossy().into_owned();
    (ends_with_any(&path, &TS_EXTENSIONS) || ends_with_any(&path, &JS_EXTENSIONS)).then_some(path)
}

/// Like `matchPatternOrExact` over the patterns of the `paths` option: the
/// substitutions of the matching pattern, and the text its `*` matched.
fn match_paths_pattern<'o, 's>(
    paths: &'o [(String, Vec<String>)],
    specifier: &'s str,
) -> Option<(&'o [String], Option<&'s str>)> {
    if let Some((_, substitutions)) = paths.iter().find(|(pattern, _)| pattern == specifier) {
        return Some((substitutions, None));
    }
    let mut best: Option<(usize, &[String], &str)> = None;
    for (pattern, substitutions) in paths {
        let Some((prefix, suffix)) = pattern.split_once('*') else {
            continue;
        };
        if suffix.contains('*') {
            continue;
        }
        if specifier.len() >= prefix.len() + suffix.len()
            && specifier.starts_with(prefix)
            && specifier.ends_with(suffix)
            && best.is_none_or(|(length, _, _)| prefix.len() > length)
        {
            let star = &specifier[prefix.len()..specifier.len() - suffix.len()];
            best = Some((prefix.len(), substitutions, star));
        }
    }
    best.map(|(_, substitutions, star)| (substitutions, Some(star)))
}

const TS_EXTENSIONS: [&str; 4] = [".ts", ".tsx", ".mts", ".cts"];
const JS_EXTENSIONS: [&str; 4] = [".js", ".jsx", ".mjs", ".cjs"];

/// Like `pathIsRelative`.
fn path_is_relative(path: &str) -> bool {
    let rest = path.strip_prefix("..").or_else(|| path.strip_prefix('.'));
    rest.is_some_and(|rest| rest.is_empty() || rest.starts_with(['/', '\\']))
}

/// Like `isExternalModuleNameRelative`.
fn is_external_module_name_relative(name: &str) -> bool {
    path_is_relative(name) || is_rooted_disk_path(name)
}

/// Like `isRootedDiskPath`.
fn is_rooted_disk_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    match bytes {
        [b'/' | b'\\', ..] => true,
        [drive, b':', ..] if drive.is_ascii_alphabetic() => true,
        _ => path
            .split_once("://")
            .is_some_and(|(scheme, _)| !scheme.is_empty() && !scheme.contains('/')),
    }
}

fn basename(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

fn join(directory: &str, name: &str) -> String {
    if directory.ends_with('/') {
        format!("{directory}{name}")
    } else {
        format!("{directory}/{name}")
    }
}

fn ends_with_any(path: &str, extensions: &[&str]) -> bool {
    extensions.iter().any(|extension| path.ends_with(extension))
}

fn contains_ignore_ascii_case(text: &str, needle: &str) -> bool {
    text.as_bytes()
        .windows(needle.len())
        .any(|window| window.eq_ignore_ascii_case(needle.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_paths_patterns() {
        let paths = vec![
            ("*".to_string(), vec!["a".to_string()]),
            ("lib/*".to_string(), vec!["b".to_string()]),
            ("lib/x".to_string(), vec!["c".to_string()]),
        ];
        assert_eq!(match_paths_pattern(&paths, "lib/x").unwrap().0, ["c"]);
        let (substitutions, star) = match_paths_pattern(&paths, "lib/y").unwrap();
        assert_eq!((substitutions, star), (&["b".to_string()][..], Some("y")));
        assert_eq!(match_paths_pattern(&paths, "z").unwrap().1, Some("z"));
    }
}
