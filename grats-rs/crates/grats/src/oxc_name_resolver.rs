//! Resolves names to their declarations. Where the TypeScript implementation
//! asked the TypeScript checker what names refer to, this resolver follows
//! names itself, the way the checker binds and resolves them, but only as far
//! as Grats needs:
//!
//! - Files are parsed with oxc as they're needed, and `oxc_semantic` resolves
//!   names within a file (scopes, same-name declaration merging, type
//!   parameters, and which references mean a value or a type).
//! - Imports are followed to the exports of the files they resolve to
//!   (declarations with `export`, `export { .. }`, `export .. from`,
//!   `export *`, `export default` and `export =`), and qualified names to the
//!   exports of namespaces and to enum members.
//! - As in TypeScript, the declarations of files which aren't modules, and
//!   those in `declare global` blocks, are merged into one global scope.
//!
//! Which files are in the program, and how imports resolve, is decided by
//! `crate::program`.
//!
//! Not supported, since Grats hasn't needed them: ambient module declarations
//! (`declare module "x"`), module augmentation, and anything which requires
//! type information, such as members of a variable exported with `export =`.

use std::cell::RefCell;
use std::rc::Rc;

use graphql_js::language::ast::Location;
use oxc_ast::AstKind;
use oxc_ast::ast::{
    Declaration, ExportDefaultDeclarationKind, Expression, IdentifierReference, ModuleExportName,
    Statement, TSModuleReference, TSNamespaceDeclaration, TSNamespaceDeclarationBody,
    TSQualifiedName, TSTypeName,
};
use oxc_semantic::NodeId;
use oxc_span::{GetSpan, Span};
use oxc_str::Ident;
use oxc_syntax::scope::ScopeId;
use oxc_syntax::symbol::{SymbolFlags, SymbolId};
use rustc_hash::FxHashSet;

use crate::files::{Files, ParsedFile};
use crate::name_resolver::{
    MergedDeclaration, MergedDeclarationKind, NameResolver, ResolvedDeclaration,
    ResolvedDeclarationKind,
};
use crate::program::Program as FileProgram;
use crate::snapshot_refs::DeclRef;

pub struct OxcNameResolver<'a> {
    files: &'a Files<'a>,
    program: &'a FileProgram<'a>,
    /// The exports being looked up, which guards against cycles of
    /// re-exports.
    resolving_exports: RefCell<FxHashSet<(String, String)>>,
}

/// What a name resolves to.
#[derive(Clone)]
enum Target<'a> {
    /// One of the declarations of a symbol.
    Declaration(Rc<ParsedFile<'a>>, NodeId),
    /// A module, as imported by `import * as ns`.
    Module(Rc<ParsedFile<'a>>),
}

/// What a name is looked up as, which TypeScript calls its meaning.
#[derive(Clone, Copy)]
enum Meaning {
    Value,
    Type,
    Namespace,
    All,
}

impl Meaning {
    fn matches(self, flags: SymbolFlags) -> bool {
        let mask = match self {
            Meaning::Value => SymbolFlags::Value,
            Meaning::Type => SymbolFlags::Type,
            Meaning::Namespace => SymbolFlags::Namespace,
            Meaning::All => SymbolFlags::all(),
        };
        flags.intersects(mask)
    }
}

impl<'a> OxcNameResolver<'a> {
    pub fn new(files: &'a Files<'a>, program: &'a FileProgram<'a>) -> Self {
        OxcNameResolver {
            files,
            program,
            resolving_exports: RefCell::new(FxHashSet::default()),
        }
    }

    /// The module which `specifier` resolves to when imported by `file`.
    fn module(&self, file: &ParsedFile<'a>, specifier: &str) -> Option<Rc<ParsedFile<'a>>> {
        // The checker only treats files which are modules as modules.
        self.program
            .resolve_module(file, specifier)
            .filter(|module| module.is_module)
    }

    /// Resolves the names in a type reference or heritage clause.
    fn resolve_type_name(
        &self,
        file: &Rc<ParsedFile<'a>>,
        name: &TSTypeName<'a>,
        meaning: Meaning,
    ) -> Vec<Target<'a>> {
        match name {
            TSTypeName::IdentifierReference(ident) => self.resolve_identifier(file, ident, meaning),
            TSTypeName::QualifiedName(name) => self.resolve_qualified_name(file, name, meaning),
            TSTypeName::ThisExpression(_) => vec![],
        }
    }

    fn resolve_qualified_name(
        &self,
        file: &Rc<ParsedFile<'a>>,
        name: &TSQualifiedName<'a>,
        meaning: Meaning,
    ) -> Vec<Target<'a>> {
        let left = self.resolve_type_name(file, &name.left, Meaning::Namespace);
        self.members(&left, &name.right.name, meaning)
    }

    fn resolve_identifier(
        &self,
        file: &Rc<ParsedFile<'a>>,
        ident: &IdentifierReference<'a>,
        meaning: Meaning,
    ) -> Vec<Target<'a>> {
        let scoping = file.semantic().scoping();
        let symbol = ident
            .reference_id
            .get()
            .and_then(|reference| scoping.get_reference(reference).symbol_id());
        match symbol {
            Some(symbol) if !file.is_global_scope(scoping.symbol_scope_id(symbol)) => {
                filter_meaning(self.symbol_targets(file, symbol), meaning)
            }
            _ => self.resolve_global(&ident.name, meaning),
        }
    }

    /// Looks up a name in the global scope, which merges the declarations of
    /// every file which isn't a module and those in `declare global` blocks.
    fn resolve_global(&self, name: &str, meaning: Meaning) -> Vec<Target<'a>> {
        let mut targets = Vec::new();
        for file in self.program.global_files(name) {
            for scope in file.global_scopes() {
                if let Some(symbol) = file
                    .semantic()
                    .scoping()
                    .get_binding(scope, Ident::from(name))
                {
                    targets.extend(self.symbol_targets(file, symbol));
                }
            }
        }
        // Unlike this, TypeScript's checker merges the global symbols of each
        // file as a whole (see `mergeSymbol`), which only differs when a file
        // declares a name twice and both conflict with another file's
        // declarations.
        let targets = merge(targets, Target::binder_flags);
        filter_meaning(targets, meaning)
    }

    /// The declarations of a symbol, after following it if it's an alias,
    /// such as an import.
    fn symbol_targets(&self, file: &Rc<ParsedFile<'a>>, symbol: SymbolId) -> Vec<Target<'a>> {
        self.declaration_targets(file, file.merged_declarations(symbol))
    }

    /// The declarations, after following any which are aliases.
    fn declaration_targets(
        &self,
        file: &Rc<ParsedFile<'a>>,
        declarations: Vec<NodeId>,
    ) -> Vec<Target<'a>> {
        declarations
            .into_iter()
            .flat_map(|declaration| {
                self.alias_targets(file, declaration)
                    .unwrap_or_else(|| vec![Target::Declaration(Rc::clone(file), declaration)])
            })
            .collect()
    }

    /// If `declaration` is an alias, what it refers to.
    fn alias_targets(
        &self,
        file: &Rc<ParsedFile<'a>>,
        declaration: NodeId,
    ) -> Option<Vec<Target<'a>>> {
        let nodes = file.semantic().nodes();
        let import_source = || match nodes.parent_kind(declaration) {
            AstKind::ImportDeclaration(import) => self.module(file, &import.source.value),
            _ => None,
        };
        let targets = match nodes.kind(declaration) {
            AstKind::ImportSpecifier(specifier) => import_source()
                .map(|module| self.export_of(&module, &specifier.imported.name(), Meaning::All))
                .unwrap_or_default(),
            AstKind::ImportDefaultSpecifier(_) => import_source()
                .map(|module| match self.export_equals(&module) {
                    // A default import of a module with `export =` (with
                    // `esModuleInterop`) imports what it exports.
                    Some(exported) => exported,
                    None => self.export_of(&module, "default", Meaning::All),
                })
                .unwrap_or_default(),
            AstKind::ImportNamespaceSpecifier(_) => import_source()
                .map(|module| self.module_targets(module))
                .unwrap_or_default(),
            AstKind::TSImportEqualsDeclaration(import) => match &import.module_reference {
                TSModuleReference::ExternalModuleReference(reference) => self
                    .module(file, &reference.expression.value)
                    .map(|module| self.module_targets(module))
                    .unwrap_or_default(),
                TSModuleReference::IdentifierReference(ident) => {
                    self.resolve_identifier(file, ident, Meaning::All)
                }
                TSModuleReference::QualifiedName(name) => {
                    self.resolve_qualified_name(file, name, Meaning::All)
                }
            },
            _ => return None,
        };
        Some(targets)
    }

    /// What importing a whole module refers to: what it exports with
    /// `export =`, if anything, or otherwise the module.
    fn module_targets(&self, module: Rc<ParsedFile<'a>>) -> Vec<Target<'a>> {
        self.export_equals(&module)
            .unwrap_or_else(|| vec![Target::Module(module)])
    }

    /// What a module exports with `export =`, if it has it.
    fn export_equals(&self, module: &Rc<ParsedFile<'a>>) -> Option<Vec<Target<'a>>> {
        module
            .program
            .body
            .iter()
            .find_map(|statement| match statement {
                Statement::TSExportAssignment(assignment) => Some(match &assignment.expression {
                    Expression::Identifier(ident) => {
                        self.resolve_identifier(module, ident, Meaning::All)
                    }
                    _ => vec![Target::Declaration(Rc::clone(module), assignment.node_id())],
                }),
                _ => None,
            })
    }

    /// What a module exports as `name`.
    fn export_of(
        &self,
        module: &Rc<ParsedFile<'a>>,
        name: &str,
        meaning: Meaning,
    ) -> Vec<Target<'a>> {
        let key = (module.path.clone(), name.to_string());
        if !self.resolving_exports.borrow_mut().insert(key.clone()) {
            return vec![];
        }
        let targets = self.export_of_worker(module, name);
        self.resolving_exports.borrow_mut().remove(&key);
        filter_meaning(targets, meaning)
    }

    fn export_of_worker(&self, module: &Rc<ParsedFile<'a>>, name: &str) -> Vec<Target<'a>> {
        if let Some(exported) = self.export_equals(module) {
            return self.members(&exported, name, Meaning::All);
        }
        let statements = &module.program.body;
        // A declaration file without export declarations exports all of its
        // declarations.
        let export_context = module.is_declaration_file && !has_export_declarations(statements);
        let root = module.semantic().scoping().root_scope_id();
        let targets = self.container_export(module, statements, root, export_context, name);
        if !targets.is_empty() || name == "default" {
            return targets;
        }
        // `export * from` re-exports everything but the default export.
        statements
            .iter()
            .filter_map(|statement| match statement {
                Statement::ExportAllDeclaration(export) if export.exported.is_none() => {
                    self.module(module, &export.source.value)
                }
                _ => None,
            })
            .map(|source| self.export_of(&source, name, Meaning::All))
            .find(|targets| !targets.is_empty())
            .unwrap_or_default()
    }

    /// What a module or namespace, whose body is `statements` and whose
    /// declarations are in `scope`, exports as `name`. In an export context,
    /// every declaration which isn't an import is exported.
    fn container_export(
        &self,
        file: &Rc<ParsedFile<'a>>,
        statements: &[Statement<'a>],
        scope: ScopeId,
        export_context: bool,
        name: &str,
    ) -> Vec<Target<'a>> {
        let scoping = file.semantic().scoping();
        // Declarations exported under their own name.
        if let Some(symbol) = scoping.get_binding(scope, Ident::from(name)) {
            let exported = scoping
                .symbol_declarations(symbol)
                .filter(|&declaration| file.is_exported(declaration, export_context));
            let exported = merge(exported, |&declaration| file.binder_flags(declaration));
            let targets = self.declaration_targets(file, exported);
            if !targets.is_empty() {
                return targets;
            }
        }
        for statement in statements {
            match statement {
                Statement::ExportNamedDeclaration(export) => {
                    for specifier in &export.specifiers {
                        if specifier.exported.name() != name {
                            continue;
                        }
                        return match &specifier.local {
                            ModuleExportName::IdentifierReference(ident) => {
                                self.resolve_identifier(file, ident, Meaning::All)
                            }
                            _ => vec![],
                        };
                    }
                }
                Statement::ExportFromDeclaration(export) => {
                    for specifier in &export.specifiers {
                        if specifier.exported.name() != name {
                            continue;
                        }
                        return self
                            .module(file, &export.source.value)
                            .map(|module| {
                                self.export_of(&module, &specifier.local.name(), Meaning::All)
                            })
                            .unwrap_or_default();
                    }
                }
                Statement::ExportAllDeclaration(export)
                    if export
                        .exported
                        .as_ref()
                        .is_some_and(|exported| exported.name() == name) =>
                {
                    return self
                        .module(file, &export.source.value)
                        .map(|module| self.module_targets(module))
                        .unwrap_or_default();
                }
                Statement::ExportDefaultDeclaration(export) if name == "default" => {
                    let declaration = match &export.declaration {
                        ExportDefaultDeclarationKind::FunctionDeclaration(function) => {
                            function.node_id()
                        }
                        ExportDefaultDeclarationKind::ClassDeclaration(class) => class.node_id(),
                        ExportDefaultDeclarationKind::TSInterfaceDeclaration(interface) => {
                            interface.node_id()
                        }
                        ExportDefaultDeclarationKind::Identifier(ident) => {
                            return self.resolve_identifier(file, ident, Meaning::All);
                        }
                        _ => export.node_id(),
                    };
                    return vec![Target::Declaration(Rc::clone(file), declaration)];
                }
                _ => {}
            }
        }
        vec![]
    }

    /// What the declarations of a symbol export as `name`: the exports of a
    /// module or namespace, or the members of an enum.
    fn members(&self, targets: &[Target<'a>], name: &str, meaning: Meaning) -> Vec<Target<'a>> {
        let mut members = Vec::new();
        for target in targets {
            let (file, declaration) = match target {
                Target::Module(module) => return self.export_of(module, name, meaning),
                Target::Declaration(file, declaration) => (file, *declaration),
            };
            match file.semantic().nodes().kind(declaration) {
                AstKind::TSNamespaceDeclaration(namespace) => {
                    members.extend(self.namespace_export(file, namespace, name));
                }
                AstKind::TSEnumDeclaration(enum_declaration) => {
                    members.extend(
                        enum_declaration
                            .body
                            .members
                            .iter()
                            .filter(|member| member.id.static_name() == name)
                            .map(|member| Target::Declaration(Rc::clone(file), member.node_id())),
                    );
                }
                _ => {}
            }
        }
        filter_meaning(members, meaning)
    }

    fn namespace_export(
        &self,
        file: &Rc<ParsedFile<'a>>,
        namespace: &TSNamespaceDeclaration<'a>,
        name: &str,
    ) -> Vec<Target<'a>> {
        match &namespace.body {
            // `namespace A.B {}` declares `B` in `A`.
            TSNamespaceDeclarationBody::TSNamespaceDeclaration(inner) => {
                if inner.id.name == name {
                    vec![Target::Declaration(Rc::clone(file), inner.node_id())]
                } else {
                    vec![]
                }
            }
            TSNamespaceDeclarationBody::TSModuleBlock(block) => {
                let export_context =
                    file.is_ambient(namespace.node_id()) && !has_export_declarations(&block.body);
                let scope = namespace
                    .scope_id
                    .get()
                    .expect("Namespaces should have a scope");
                self.container_export(file, &block.body, scope, export_context, name)
            }
        }
    }

    fn resolved_declaration(&self, target: &Target<'a>) -> ResolvedDeclaration {
        let (file, declaration) = match target {
            Target::Module(module) => {
                let span = module.module_span();
                return ResolvedDeclaration {
                    kind: ResolvedDeclarationKind::Declaration,
                    decl_loc: module.decl_loc(span.start),
                    loc: module.location(span),
                };
            }
            Target::Declaration(file, declaration) => (file, *declaration),
        };
        let kind = match file.semantic().nodes().kind(declaration) {
            AstKind::TSTypeParameter(_) => ResolvedDeclarationKind::TypeParameter,
            _ => ResolvedDeclarationKind::Declaration,
        };
        let span = file.declaration_span(declaration);
        let anchor = file.declaration_name(declaration).unwrap_or(span);
        ResolvedDeclaration {
            kind,
            decl_loc: file.decl_loc(anchor.start),
            loc: file.location(span),
        }
    }

    fn merged_declaration(&self, file: &ParsedFile<'a>, declaration: NodeId) -> MergedDeclaration {
        let kind = match file.semantic().nodes().kind(declaration) {
            AstKind::TSInterfaceDeclaration(_) => MergedDeclarationKind::Interface,
            AstKind::Class(_) => MergedDeclarationKind::Class,
            _ => MergedDeclarationKind::Other,
        };
        let name = file
            .declaration_name(declaration)
            .unwrap_or_else(|| file.declaration_span(declaration));
        MergedDeclaration {
            kind,
            decl_loc: file.decl_loc(name.start),
            name: file.location(name),
        }
    }
}

impl NameResolver for OxcNameResolver<'_> {
    fn resolve_entity_name(&self, name: Location) -> Vec<ResolvedDeclaration> {
        let file = self.files.source_file(name.source);
        let node = file.name_at(name);
        let nodes = file.semantic().nodes();
        // Heritage clauses of classes (`extends`) name values. Other entity
        // names Grats resolves name types.
        let meaning = match nodes.parent_kind(node) {
            AstKind::Class(_) => Meaning::Value,
            _ => Meaning::Type,
        };
        let targets = match nodes.kind(node) {
            AstKind::IdentifierReference(ident) => self.resolve_identifier(&file, ident, meaning),
            AstKind::TSQualifiedName(name) => self.resolve_qualified_name(&file, name, meaning),
            _ => vec![],
        };
        targets
            .iter()
            .map(|target| self.resolved_declaration(target))
            .collect()
    }

    fn merged_declarations(&self, declaration: &DeclRef) -> Vec<MergedDeclaration> {
        let file = self.files.source_file(declaration.name.source);
        let Some(&node) = file.names().get(&file.span_key(declaration.name)) else {
            return vec![];
        };
        let AstKind::BindingIdentifier(ident) = file.semantic().nodes().kind(node) else {
            return vec![];
        };
        let scoping = file.semantic().scoping();
        let symbol = ident.symbol_id();
        let own = file.semantic().nodes().parent_id(node);
        let merged: Vec<(Rc<ParsedFile>, NodeId)> =
            if file.is_global_scope(scoping.symbol_scope_id(symbol)) {
                self.resolve_global(&ident.name, Meaning::All)
                    .into_iter()
                    .filter_map(|target| match target {
                        Target::Declaration(file, declaration) => Some((file, declaration)),
                        Target::Module(_) => None,
                    })
                    .collect()
            } else {
                file.merged_declarations(symbol)
                    .into_iter()
                    .map(|declaration| (Rc::clone(&file), declaration))
                    .collect()
            };
        // A declaration which TypeScript couldn't merge has a symbol of its
        // own.
        if !merged
            .iter()
            .any(|(merged_file, declaration)| merged_file.path == file.path && *declaration == own)
        {
            return vec![self.merged_declaration(&file, own)];
        }
        merged
            .iter()
            .map(|(file, declaration)| self.merged_declaration(file, *declaration))
            .collect()
    }
}

impl<'a> ParsedFile<'a> {
    fn span_key(&self, loc: Location) -> (u32, u32) {
        (
            self.offsets.to_utf8(loc.start),
            self.offsets.to_utf8(loc.end),
        )
    }

    /// The entity name at `loc`.
    fn name_at(&self, loc: Location) -> NodeId {
        *self.names().get(&self.span_key(loc)).unwrap_or_else(|| {
            panic!(
                "Could not find node at {}:{}-{}.",
                self.path, loc.start, loc.end
            )
        })
    }

    fn location(&self, span: Span) -> Location {
        Location {
            source: self.source,
            start: self.offsets.to_utf16(span.start),
            end: self.offsets.to_utf16(span.end),
        }
    }

    /// A `DeclLoc` for the declaration whose name (or, if it has none, the
    /// declaration itself) starts at `start`.
    fn decl_loc(&self, start: u32) -> String {
        format!("{}:{}", self.path, self.offsets.to_utf16(start))
    }

    /// Whether names declared in `scope` are global.
    fn is_global_scope(&self, scope: ScopeId) -> bool {
        let scoping = self.semantic().scoping();
        if scope == scoping.root_scope_id() {
            return !self.is_module;
        }
        matches!(
            self.semantic().nodes().kind(scoping.get_node_id(scope)),
            AstKind::TSGlobalDeclaration(_)
        )
    }

    /// The scopes whose declarations are merged into the global scope.
    fn global_scopes(&self) -> Vec<ScopeId> {
        if !self.is_module {
            return vec![self.semantic().scoping().root_scope_id()];
        }
        self.program
            .body
            .iter()
            .filter_map(|statement| match statement {
                Statement::TSGlobalDeclaration(global) => global.scope_id.get(),
                _ => None,
            })
            .collect()
    }

    /// The declarations of `symbol` which TypeScript merges into the symbol
    /// of their name in its scope. Its binder gives each declaration which
    /// can't merge with those before it (a duplicate identifier) a symbol of
    /// its own.
    fn merged_declarations(&self, symbol: SymbolId) -> Vec<NodeId> {
        let scoping = self.semantic().scoping();
        let export_context = self.export_context(scoping.symbol_scope_id(symbol));
        merge(scoping.symbol_declarations(symbol), |&declaration| {
            let (includes, excludes) = self.binder_flags(declaration);
            // The declarations a module or namespace exports are merged into
            // its exports. Its locals only record whether they're values (see
            // `declareModuleMember`).
            if !export_context.is_some_and(|context| self.has_export_modifier(declaration, context))
            {
                (includes, excludes)
            } else if includes.intersects(SymbolFlags::Value) {
                (EXPORT_VALUE, excludes)
            } else {
                (SymbolFlags::empty(), excludes)
            }
        })
    }

    /// If `scope` is a module or namespace, whether it's an export context,
    /// in which every declaration which isn't an import is exported.
    fn export_context(&self, scope: ScopeId) -> Option<bool> {
        let scoping = self.semantic().scoping();
        if scope == scoping.root_scope_id() {
            let statements = &self.program.body;
            return self
                .is_module
                .then(|| self.is_declaration_file && !has_export_declarations(statements));
        }
        let node = scoping.get_node_id(scope);
        match self.semantic().nodes().kind(node) {
            AstKind::TSNamespaceDeclaration(TSNamespaceDeclaration {
                body: TSNamespaceDeclarationBody::TSModuleBlock(block),
                ..
            }) => Some(self.is_ambient(node) && !has_export_declarations(&block.body)),
            _ => None,
        }
    }

    /// Whether a declaration is exported from its module or namespace under
    /// its own name.
    fn is_exported(&self, declaration: NodeId, export_context: bool) -> bool {
        !matches!(
            self.semantic()
                .nodes()
                .parent_kind(self.statement(declaration)),
            AstKind::ExportDefaultDeclaration(_)
        ) && self.has_export_modifier(declaration, export_context)
    }

    /// Whether a declaration is exported from its module or namespace, as
    /// the default export or under its own name.
    fn has_export_modifier(&self, declaration: NodeId, export_context: bool) -> bool {
        let nodes = self.semantic().nodes();
        if let AstKind::ExportDeclaration(_) | AstKind::ExportDefaultDeclaration(_) =
            nodes.parent_kind(self.statement(declaration))
        {
            return true;
        }
        // Imports are never implicitly exported.
        let is_alias = matches!(
            nodes.kind(declaration),
            AstKind::ImportSpecifier(_)
                | AstKind::ImportDefaultSpecifier(_)
                | AstKind::ImportNamespaceSpecifier(_)
                | AstKind::TSImportEqualsDeclaration(_)
        );
        export_context && !is_alias
    }

    /// The statement of a declaration, which `export` may wrap.
    fn statement(&self, declaration: NodeId) -> NodeId {
        let nodes = self.semantic().nodes();
        match nodes.kind(declaration) {
            AstKind::VariableDeclarator(_) => nodes.parent_id(declaration),
            _ => declaration,
        }
    }

    /// The flags which a declaration gives its symbol, and the flags of the
    /// declarations it can't merge with, as TypeScript's binder has them.
    fn binder_flags(&self, declaration: NodeId) -> (SymbolFlags, SymbolFlags) {
        let nodes = self.semantic().nodes();
        let is_var = || {
            matches!(
                nodes.parent_kind(declaration),
                AstKind::VariableDeclaration(variable) if variable.kind.is_var()
            )
        };
        match nodes.kind(declaration) {
            AstKind::Class(_) => (SymbolFlags::Class, SymbolFlags::ClassExcludes),
            AstKind::Function(_) => (SymbolFlags::Function, SymbolFlags::FunctionExcludes),
            // oxc's `FunctionScopedVariableExcludes` also excludes functions.
            AstKind::VariableDeclarator(_) if is_var() => (
                SymbolFlags::FunctionScopedVariable,
                SymbolFlags::Value - SymbolFlags::FunctionScopedVariable,
            ),
            AstKind::VariableDeclarator(_) => (
                SymbolFlags::BlockScopedVariable,
                SymbolFlags::BlockScopedVariableExcludes,
            ),
            AstKind::TSInterfaceDeclaration(_) => {
                (SymbolFlags::Interface, SymbolFlags::InterfaceExcludes)
            }
            AstKind::TSTypeAliasDeclaration(_) => {
                (SymbolFlags::TypeAlias, SymbolFlags::TypeAliasExcludes)
            }
            AstKind::TSEnumDeclaration(enum_declaration) if enum_declaration.r#const => {
                (SymbolFlags::ConstEnum, SymbolFlags::ConstEnumExcludes)
            }
            AstKind::TSEnumDeclaration(_) => {
                (SymbolFlags::RegularEnum, SymbolFlags::RegularEnumExcludes)
            }
            // oxc's `EnumMemberExcludes` only excludes enum members.
            AstKind::TSEnumMember(_) => (
                SymbolFlags::EnumMember,
                SymbolFlags::Value | SymbolFlags::Type,
            ),
            AstKind::TSTypeParameter(_) => (
                SymbolFlags::TypeParameter,
                SymbolFlags::TypeParameterExcludes,
            ),
            AstKind::TSNamespaceDeclaration(namespace) if !is_instantiated(&namespace.body) => (
                SymbolFlags::NamespaceModule,
                SymbolFlags::NamespaceModuleExcludes,
            ),
            AstKind::TSNamespaceDeclaration(_) | AstKind::TSExternalModuleDeclaration(_) => {
                (SymbolFlags::ValueModule, SymbolFlags::ValueModuleExcludes)
            }
            AstKind::ImportSpecifier(_)
            | AstKind::ImportDefaultSpecifier(_)
            | AstKind::ImportNamespaceSpecifier(_)
            | AstKind::TSImportEqualsDeclaration(_) => (SymbolFlags::Import, SymbolFlags::Import),
            // The value of `export default` or `export =`.
            _ => (SymbolFlags::Variable, SymbolFlags::empty()),
        }
    }

    /// Whether a node is in an ambient context, where declarations are
    /// implicitly exported from namespaces without export declarations.
    fn is_ambient(&self, node: NodeId) -> bool {
        if self.is_declaration_file {
            return true;
        }
        let nodes = self.semantic().nodes();
        std::iter::once(node)
            .chain(nodes.ancestor_ids(node))
            .any(|id| match nodes.kind(id) {
                AstKind::TSNamespaceDeclaration(namespace) => namespace.declare,
                AstKind::TSExternalModuleDeclaration(module) => module.declare,
                AstKind::TSGlobalDeclaration(global) => global.declare,
                _ => false,
            })
    }

    /// The span of a declaration's name, if it has one.
    fn declaration_name(&self, declaration: NodeId) -> Option<Span> {
        match self.semantic().nodes().kind(declaration) {
            AstKind::Class(class) => class.id.as_ref().map(|id| id.span),
            AstKind::Function(function) => function.id.as_ref().map(|id| id.span),
            AstKind::VariableDeclarator(declarator) => Some(declarator.id.span()),
            AstKind::TSInterfaceDeclaration(interface) => Some(interface.id.span),
            AstKind::TSTypeAliasDeclaration(alias) => Some(alias.id.span),
            AstKind::TSEnumDeclaration(enum_declaration) => Some(enum_declaration.id.span),
            AstKind::TSEnumMember(member) => Some(member.id.span()),
            AstKind::TSNamespaceDeclaration(namespace) => Some(namespace.id.span),
            AstKind::TSExternalModuleDeclaration(module) => Some(module.id.span),
            AstKind::TSTypeParameter(parameter) => Some(parameter.name.span),
            AstKind::TSImportEqualsDeclaration(import) => Some(import.id.span),
            _ => None,
        }
    }

    /// The span of a whole declaration, as TypeScript's `getStart()` and
    /// `getEnd()` give it: including any modifiers and decorators, which
    /// oxc puts in an `export` statement around it.
    fn declaration_span(&self, declaration: NodeId) -> Span {
        let nodes = self.semantic().nodes();
        let kind = nodes.kind(declaration);
        let mut span = kind.span();
        if !matches!(kind, AstKind::VariableDeclarator(_)) {
            let parent = nodes.parent_kind(declaration);
            if let AstKind::ExportDeclaration(_) | AstKind::ExportDefaultDeclaration(_) = parent {
                span.start = span.start.min(parent.span().start);
            }
        }
        if let AstKind::Class(class) = kind
            && let Some(decorator) = class.decorators.first()
        {
            span.start = span.start.min(decorator.span.start);
        }
        span
    }

    /// The span of a module as a declaration, from its first token.
    fn module_span(&self) -> Span {
        let program = self.program;
        let start = program
            .directives
            .first()
            .map(|directive| directive.span.start)
            .into_iter()
            .chain(program.body.first().map(|statement| statement.span().start))
            .min()
            .unwrap_or(program.span.end);
        Span::new(start, program.span.end)
    }
}

/// Whether a module or namespace body has export declarations, without
/// which declaration files and ambient namespaces export all of their
/// declarations.
fn has_export_declarations(statements: &[Statement]) -> bool {
    statements.iter().any(|statement| match statement {
        Statement::ExportNamedDeclaration(_)
        | Statement::ExportFromDeclaration(_)
        | Statement::ExportAllDeclaration(_)
        | Statement::TSExportAssignment(_) => true,
        Statement::ExportDefaultDeclaration(export) => export.declaration.is_expression(),
        _ => false,
    })
}

/// Drops `targets` unless the symbol they're the declarations of has
/// `meaning`, as TypeScript checks when it looks up a name.
fn filter_meaning(targets: Vec<Target>, meaning: Meaning) -> Vec<Target> {
    let flags = targets
        .iter()
        .fold(SymbolFlags::empty(), |flags, target| flags | target.flags());
    if meaning.matches(flags) {
        targets
    } else {
        vec![]
    }
}

impl Target<'_> {
    fn flags(&self) -> SymbolFlags {
        self.binder_flags().0
    }

    fn binder_flags(&self) -> (SymbolFlags, SymbolFlags) {
        match self {
            Target::Module(_) => (SymbolFlags::ValueModule, SymbolFlags::ValueModuleExcludes),
            Target::Declaration(file, declaration) => file.binder_flags(*declaration),
        }
    }
}

/// Stands in for TypeScript's `SymbolFlags.ExportValue`, which oxc doesn't
/// have: the flag of a value which a module or namespace exports, in its
/// locals.
const EXPORT_VALUE: SymbolFlags = SymbolFlags::from_bits_retain(1 << 31);

/// Merges declarations into one symbol the way TypeScript's binder does:
/// each declaration whose excluded flags (the second of `flags`) conflict
/// with the flags of those before it is left out.
fn merge<T>(
    declarations: impl IntoIterator<Item = T>,
    flags: impl Fn(&T) -> (SymbolFlags, SymbolFlags),
) -> Vec<T> {
    let mut merged_flags = SymbolFlags::empty();
    let mut merged = Vec::new();
    for declaration in declarations {
        let (includes, excludes) = flags(&declaration);
        if merged_flags.intersects(excludes) {
            continue;
        }
        merged_flags |= includes;
        merged.push(declaration);
    }
    merged
}

/// Whether a namespace has values, which TypeScript calls instantiated (see
/// `getModuleInstanceState`).
fn is_instantiated(body: &TSNamespaceDeclarationBody) -> bool {
    match body {
        TSNamespaceDeclarationBody::TSNamespaceDeclaration(inner) => is_instantiated(&inner.body),
        TSNamespaceDeclarationBody::TSModuleBlock(block) => {
            block.body.iter().any(|statement| match statement {
                Statement::TSInterfaceDeclaration(_)
                | Statement::TSTypeAliasDeclaration(_)
                | Statement::ImportDeclaration(_)
                | Statement::TSImportEqualsDeclaration(_) => false,
                Statement::TSNamespaceDeclaration(namespace) => is_instantiated(&namespace.body),
                Statement::ExportDeclaration(export) => match &export.declaration {
                    Declaration::TSInterfaceDeclaration(_)
                    | Declaration::TSTypeAliasDeclaration(_) => false,
                    Declaration::TSNamespaceDeclaration(namespace) => {
                        is_instantiated(&namespace.body)
                    }
                    _ => true,
                },
                _ => true,
            })
        }
    }
}
