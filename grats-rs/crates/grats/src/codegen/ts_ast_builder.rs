//! Port of `src/codegen/TSAstBuilder.ts`.
//!
//! PORT: Builds an oxc AST and prints it with `oxc_codegen`, where the
//! TypeScript implementation uses the TypeScript compiler's factory and
//! printer. Only the parts used by ported codegen are ported so far.

use indexmap::IndexMap;
use oxc_allocator::{Allocator, ArenaVec, GetAllocator};
use oxc_ast::ast::*;
use oxc_ast::builder::{AstBuilder, GetAstBuilder};
use oxc_codegen::Codegen;
use oxc_span::{SPAN, SourceType};

use crate::grats_root::resolve_relative_path;
use crate::utils::path;

pub struct ImportSpecifier {
    pub name: String,
    pub r#as: Option<String>,
    pub is_type_only: bool,
}

/// A helper class to build up a TypeScript document AST.
///
/// PORT: Implements `GetAstBuilder`, so it can be passed to oxc's AST builder
/// methods in place of the TypeScript implementation's `ts.factory`.
pub struct TsAstBuilder<'a> {
    builder: AstBuilder<'a>,
    /// `_imports` in the TypeScript implementation.
    import_statements: Vec<Statement<'a>>,
    pub imports: IndexMap<String, Vec<ImportSpecifier>>,
    helpers: Vec<Statement<'a>>,
    statements: Vec<Statement<'a>>,
    destination: String,
    import_module_specifier_ending: String,
    /// PORT: See `src/grats_root.rs`.
    grats_root: String,
}

impl<'a> GetAstBuilder<'a> for TsAstBuilder<'a> {
    type Builder = AstBuilder<'a>;

    fn builder(&self) -> &AstBuilder<'a> {
        &self.builder
    }
}

impl<'a> GetAllocator<'a> for TsAstBuilder<'a> {
    fn allocator(&self) -> &'a Allocator {
        self.builder.allocator()
    }
}

impl<'a> TsAstBuilder<'a> {
    pub fn new(
        allocator: &'a Allocator,
        destination: &str,
        import_module_specifier_ending: &str,
        grats_root: &str,
    ) -> Self {
        TsAstBuilder {
            builder: AstBuilder::new(allocator),
            import_statements: Vec::new(),
            imports: IndexMap::new(),
            helpers: Vec::new(),
            statements: Vec::new(),
            destination: destination.to_string(),
            import_module_specifier_ending: import_module_specifier_ending.to_string(),
            grats_root: grats_root.to_string(),
        }
    }

    pub fn add_helper(&mut self, statement: Statement<'a>) {
        self.helpers.push(statement);
    }

    pub fn add_statement(&mut self, statement: Statement<'a>) {
        self.statements.push(statement);
    }

    pub fn import(&mut self, from: &str, names: Vec<ImportSpecifier>) {
        let module_imports = self.imports.entry(from.to_string()).or_default();
        for ImportSpecifier {
            name,
            r#as,
            is_type_only,
        } in names
        {
            let mut seen = false;
            for imp in module_imports.iter_mut() {
                if imp.name == name && imp.r#as == r#as {
                    // If a name is imported both as type only and as a value, it needs to
                    // be imported as a value.
                    if imp.is_type_only && !is_type_only {
                        imp.is_type_only = false;
                    }
                    seen = true;
                }
            }
            if !seen {
                module_imports.push(ImportSpecifier {
                    name,
                    r#as,
                    is_type_only,
                });
            }
        }
    }

    pub fn import_default(&mut self, from: &str, r#as: &str) {
        let specifier = ImportDeclarationSpecifier::new_import_default_specifier(
            SPAN,
            BindingIdentifier::new(SPAN, Ident::from_str_in(r#as, self), self),
            self,
        );
        self.import_statements
            .push(Statement::new_import_declaration(
                SPAN,
                Some(ArenaVec::from_array_in([specifier], self)),
                StringLiteral::new(SPAN, Str::from_str_in(from, self), None, self),
                None,
                None,
                ImportOrExportKind::Value,
                self,
            ));
    }

    pub fn import_user_construct(
        &mut self,
        ts_module_path: &str,
        export_name: Option<&str>,
        local_name: &str,
        is_type_only: bool,
    ) {
        let abs = resolve_relative_path(&self.grats_root, ts_module_path);
        let relative = replace_ext(
            &path::relative(path::dirname(&self.destination), &abs),
            &self.import_module_specifier_ending,
        );
        let module_path = format!("./{}", normalize_relative_path_to_posix(&relative));
        match export_name {
            None => self.import_default(&module_path, local_name),
            Some(export_name) => self.import(
                &module_path,
                vec![ImportSpecifier {
                    name: export_name.to_string(),
                    r#as: Some(local_name.to_string()),
                    is_type_only,
                }],
            ),
        }
    }

    /// PORT: Takes `self`, since printing moves the AST into the program.
    pub fn print(mut self) -> String {
        for (from, names) in std::mem::take(&mut self.imports) {
            let all_imports_are_type_only = names.iter().all(|name| name.is_type_only);
            let named_imports = ArenaVec::from_iter_in(
                names.iter().map(|name| {
                    // If all the imports are type only, then we don't need to mark each
                    // individual import as type only.
                    let is_type_only = !all_imports_are_type_only && name.is_type_only;

                    // PORT: oxc import specifiers always have a local name, and
                    // are printed without `as` if it matches the imported name.
                    let local = match &name.r#as {
                        Some(r#as) if *r#as != name.name => r#as,
                        _ => &name.name,
                    };
                    ImportDeclarationSpecifier::new_import_specifier(
                        SPAN,
                        ModuleExportName::new_identifier_name(
                            SPAN,
                            Ident::from_str_in(&name.name, &self),
                            &self,
                        ),
                        BindingIdentifier::new(SPAN, Ident::from_str_in(local, &self), &self),
                        import_kind(is_type_only),
                        &self,
                    )
                }),
                &self,
            );
            let statement = Statement::new_import_declaration(
                SPAN,
                Some(named_imports),
                StringLiteral::new(SPAN, Str::from_str_in(&from, &self), None, &self),
                None,
                None,
                import_kind(all_imports_are_type_only),
                &self,
            );
            self.import_statements.push(statement);
        }

        let body = ArenaVec::from_iter_in(
            std::mem::take(&mut self.import_statements)
                .into_iter()
                .chain(std::mem::take(&mut self.helpers))
                .chain(std::mem::take(&mut self.statements)),
            &self,
        );
        let program = Program::new(
            SPAN,
            SourceType::ts(),
            "",
            ArenaVec::new_in(&self),
            None,
            ArenaVec::new_in(&self),
            body,
            &self,
        );
        Codegen::new().build(&program).code
    }
}

fn import_kind(is_type_only: bool) -> ImportOrExportKind {
    if is_type_only {
        ImportOrExportKind::Type
    } else {
        ImportOrExportKind::Value
    }
}

fn replace_ext(file_path: &str, new_suffix: &str) -> String {
    let ext = path::extname(file_path);
    // PORT: In JavaScript, `filePath.slice(0, -ext.length)` is empty when
    // there's no extension.
    let stem = if ext.is_empty() {
        ""
    } else {
        &file_path[..file_path.len() - ext.len()]
    };
    format!("{stem}{new_suffix}")
}

// https://github.com/sindresorhus/slash/blob/98b618f5a3bfcb5dd374b204868818845b87bb2f/index.js#L8C9-L8C33
fn normalize_relative_path_to_posix(unknown_path: &str) -> String {
    unknown_path.replace('\\', "/")
}
