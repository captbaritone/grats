//! PORT: Replaces `ts.createProgram`, which found the files of the program,
//! and `src/gratsSourceFiles.ts`, which picked the files to extract GraphQL
//! definitions from. The root files come from `tsconfig.json` (see
//! `crate::project`).
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
//!   and its extension, as with `moduleDetection: "auto"` without a
//!   `package.json` `type`, and without looking for `import.meta` or JSX.
//! - Imports are resolved as with `moduleResolution: "bundler"`, whatever
//!   the options say, with the `import` condition, or `require` for `import
//!   =`. `customConditions`, `preserveSymlinks` and `resolution-mode` are
//!   ignored: files in `node_modules` are known by their real path.
//!   `typesVersions` ranges, `types@<range>` conditions and falling through
//!   to the next condition of `exports` or `imports` aren't supported. A
//!   package's imports of its own name and its `#imports` don't map
//!   JavaScript files to their declaration files, and packages naming only
//!   JavaScript files don't fall back to `@types`. Packages installed twice
//!   aren't redirected to one copy.

use std::cell::OnceCell;
use std::collections::{HashMap, HashSet};
use std::io;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::Arc;

use oxc_ast::ast::{
    BindingPattern, Declaration, Program as AstProgram, Statement, TSModuleReference,
};
use oxc_resolver::{
    FileMetadata, FileSystem, ResolveError, ResolveOptions, ResolverGeneric, TsconfigDiscovery,
    TsconfigOptions, TsconfigReferences,
};
use oxc_span::SourceType;
use serde::{Deserialize, Serialize};

use crate::files::{Files, ParsedFile};
use crate::host::{FileKind, Host};
use crate::utils::path;

/// What decides the files of the program. See `crate::project`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramOptions {
    pub root_names: Vec<String>,
    /// Whether imported JavaScript files are part of the program.
    pub allow_js: bool,
    /// The `tsconfig.json` whose `paths`, `baseUrl` and `rootDirs` apply to
    /// imports, if any.
    pub tsconfig: Option<String>,
    pub use_case_sensitive_file_names: bool,
}

/// How a module is imported: with `import`, or with `import x = require()`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum Mode {
    Import = 0,
    Require = 1,
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
    mode: Mode,
}

struct Builder<'p, 'a> {
    files: &'a Files<'a>,
    options: &'p ProgramOptions,
    resolvers: Resolvers,
    /// The keys of the files the walk has come across.
    visited: HashSet<String>,
    source_files: Vec<Rc<ParsedFile<'a>>>,
    resolutions: HashMap<String, HashMap<String, Option<String>>>,
    /// By the containing directory, specifier and mode.
    module_resolutions: HashMap<(String, String, Mode), Option<String>>,
}

impl<'p, 'a> Builder<'p, 'a> {
    fn new(files: &'a Files<'a>, host: Arc<dyn Host>, options: &'p ProgramOptions) -> Self {
        Builder {
            files,
            resolvers: Resolvers::new(host, options),
            options,
            visited: HashSet::new(),
            source_files: Vec::new(),
            resolutions: HashMap::new(),
            module_resolutions: HashMap::new(),
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
        let mut imports = None;
        let file = self.files.load(path, |program, source_type| {
            let (file_imports, is_module) = scan_file(program, source_type, path);
            imports = Some(file_imports);
            is_module
        })?;
        Some(Rc::new(Scanned {
            file,
            imports: imports.expect("Files should only be loaded by the program"),
        }))
    }

    /// Like `resolveModuleName`.
    fn resolve_module_name(
        &mut self,
        containing_file: &str,
        specifier: &str,
        mode: Mode,
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
        mode: Mode,
    ) -> Option<String> {
        // Relative imports and `#imports` don't follow symbolic links.
        let resolvers = if specifier.starts_with(['.', '/', '#']) {
            &self.resolvers.no_realpath
        } else {
            &self.resolvers.realpath
        };
        resolve_dts(&resolvers[mode as usize], containing_file, specifier)
    }
}

/// Scans a file for the modules it imports. Returns them and whether the
/// file is a module.
fn scan_file(program: &AstProgram, source_type: SourceType, path: &str) -> (Vec<Import>, bool) {
    // Like `setExternalModuleIndicator`.
    let is_module = program.body.iter().any(is_external_module_indicator)
        || (!source_type.is_typescript_definition()
            && ends_with_any(path, &[".cjs", ".cts", ".mjs", ".mts"]));
    let imports = program
        .body
        .iter()
        .filter_map(|statement| {
            let (specifier, mode) = module_reference(statement)?;
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

/// The module a statement imports, if any, and how.
fn module_reference<'s>(statement: &'s Statement) -> Option<(&'s str, Mode)> {
    let (specifier, mode) = match statement {
        Statement::ImportDeclaration(import) => (import.source.value.as_str(), Mode::Import),
        Statement::ExportFromDeclaration(export) => (export.source.value.as_str(), Mode::Import),
        Statement::ExportAllDeclaration(export) => (export.source.value.as_str(), Mode::Import),
        Statement::TSImportEqualsDeclaration(import) => (
            external_module_reference(&import.module_reference)?,
            Mode::Require,
        ),
        Statement::ExportDeclaration(export) => match &export.declaration {
            Declaration::TSImportEqualsDeclaration(import) => (
                external_module_reference(&import.module_reference)?,
                Mode::Require,
            ),
            _ => return None,
        },
        _ => return None,
    };
    (!specifier.is_empty()).then_some((specifier, mode))
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

/// Answers `oxc_resolver`'s file system calls through the host.
pub(crate) struct HostFileSystem {
    pub(crate) host: Arc<dyn Host>,
}

impl HostFileSystem {
    fn stat(&self, path: &Path, follow_links: bool) -> io::Result<FileMetadata> {
        let kind = self
            .host
            .stat(&path::from_std(path), follow_links)
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
            .read_file(&path::from_std(path))
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
            .read_link(&path::from_std(path))
            .map(|path| path::to_std(&path))
            .ok_or_else(|| ResolveError::from(not_found()))
    }

    fn canonicalize(&self, path: &Path) -> io::Result<PathBuf> {
        self.host
            .realpath(&path::from_std(path))
            .map(|path| path::to_std(&path))
            .ok_or_else(not_found)
    }
}

/// The resolvers for each mode, which share a cache.
struct Resolvers {
    /// Follow symbolic links to the files they find, as TypeScript does for
    /// files found in `node_modules`.
    realpath: [ResolverGeneric<HostFileSystem>; 2],
    /// Don't follow symbolic links to the files they find, as TypeScript
    /// doesn't for relative imports.
    no_realpath: [ResolverGeneric<HostFileSystem>; 2],
}

impl Resolvers {
    fn new(host: Arc<dyn Host>, options: &ProgramOptions) -> Self {
        let resolve_options = |mode, symlinks| ResolveOptions {
            // Like `getConditions` under `moduleResolution: "bundler"`.
            condition_names: vec![
                match mode {
                    Mode::Import => "import".to_string(),
                    Mode::Require => "require".to_string(),
                },
                "types".to_string(),
            ],
            symlinks,
            node_path: false,
            tsconfig: options.tsconfig.as_ref().map(|config_file| {
                TsconfigDiscovery::Manual(TsconfigOptions {
                    config_file: path::to_std(config_file),
                    references: TsconfigReferences::Disabled,
                })
            }),
            ..ResolveOptions::default()
        };
        let modes = [Mode::Import, Mode::Require];
        let resolver = ResolverGeneric::new_with_file_system(
            HostFileSystem { host },
            resolve_options(Mode::Import, false),
        );
        Resolvers {
            realpath: modes.map(|mode| resolver.clone_with_options(resolve_options(mode, true))),
            no_realpath: modes
                .map(|mode| resolver.clone_with_options(resolve_options(mode, false))),
        }
    }
}

/// The file `specifier` resolves to from `containing_file`, if it's a
/// TypeScript or JavaScript file.
fn resolve_dts(
    resolver: &ResolverGeneric<HostFileSystem>,
    containing_file: &str,
    specifier: &str,
) -> Option<String> {
    let resolution = resolver
        .resolve_dts(path::to_std(containing_file), specifier)
        .ok()?;
    let path = path::from_std(resolution.path());
    (ends_with_any(&path, &TS_EXTENSIONS) || ends_with_any(&path, &JS_EXTENSIONS)).then_some(path)
}

const TS_EXTENSIONS: [&str; 4] = [".ts", ".tsx", ".mts", ".cts"];
const JS_EXTENSIONS: [&str; 4] = [".js", ".jsx", ".mjs", ".cjs"];

fn ends_with_any(path: &str, extensions: &[&str]) -> bool {
    extensions.iter().any(|extension| path.ends_with(extension))
}

fn contains_ignore_ascii_case(text: &str, needle: &str) -> bool {
    text.as_bytes()
        .windows(needle.len())
        .any(|window| window.eq_ignore_ascii_case(needle.as_bytes()))
}
