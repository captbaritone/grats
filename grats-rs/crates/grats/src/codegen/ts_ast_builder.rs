//! Port of `src/codegen/TSAstBuilder.ts`.
//!
//! PORT: Builds an oxc AST and prints it with `oxc_codegen`, where the
//! TypeScript implementation uses the TypeScript compiler's factory and
//! printer. The printers differ in whitespace, which is not significant: the
//! test harness formats generated code with prettier before comparing it.
//! Where the TypeScript printer's choices do survive formatting, such as how
//! string literals are escaped, this reproduces them.

use std::collections::HashMap;

use graphql_js::js_value::Value;
use indexmap::IndexMap;
use oxc_allocator::{Allocator, ArenaBox, ArenaVec, GetAllocator};
use oxc_ast::ast::*;
use oxc_ast::builder::{AstBuilder, GetAstBuilder};
use oxc_codegen::{Codegen, CodegenOptions, IndentChar};
use oxc_span::{SPAN, SourceType};
use oxc_syntax::number::ToJsString;

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
    global_names: HashMap<String, usize>,
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
            global_names: HashMap::new(),
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

    /// PORT: Takes the closure's context, which gives it access to the
    /// builder, rather than capturing it.
    pub fn create_block_with_scope<C: AsMut<Self>>(
        context: &mut C,
        closure: impl FnOnce(&mut C),
    ) -> ArenaBox<'a, FunctionBody<'a>> {
        let initial_statements = std::mem::take(&mut context.as_mut().statements);
        closure(context);
        let ts = context.as_mut();
        let statements = std::mem::replace(&mut ts.statements, initial_statements);
        ts.block(statements)
    }

    // Helper for the common case.
    pub fn method(
        &self,
        name: &str,
        params: Vec<FormalParameter<'a>>,
        statements: Vec<Statement<'a>>,
        is_async: bool,
    ) -> ObjectPropertyKind<'a> {
        let function = Expression::new_function_expression(
            SPAN,
            FunctionType::FunctionExpression,
            None,
            false,
            is_async,
            false,
            None::<ArenaBox<TSTypeParameterDeclaration>>,
            None::<ArenaBox<TSThisParameter>>,
            self.formal_parameters(params),
            None::<ArenaBox<TSTypeAnnotation>>,
            Some(self.block(statements)),
            self,
        );
        ObjectPropertyKind::new_object_property(
            SPAN,
            PropertyKind::Init,
            self.property_name(name),
            function,
            true,
            false,
            false,
            self,
        )
    }

    // Helper for the common case of a single string argument.
    pub fn param(&self, name: &str, r#type: Option<TSType<'a>>) -> FormalParameter<'a> {
        FormalParameter::new(
            SPAN,
            ArenaVec::new_in(self),
            BindingPattern::new_binding_identifier(SPAN, Ident::from_str_in(name, self), self),
            r#type.map(|r#type| self.type_annotation(r#type)),
            None::<ArenaBox<Expression>>,
            false,
            None,
            false,
            false,
            self,
        )
    }

    /// PORT: Takes member names rather than identifiers.
    pub fn property_access_chain(
        &self,
        parent: Expression<'a>,
        members: &[&str],
    ) -> Expression<'a> {
        let mut expr = parent;
        for member in members {
            expr = self.property_access(expr, member);
        }
        expr
    }

    /// PORT: Takes whether to export the function, the only modifier used,
    /// rather than a list of modifiers.
    pub fn function_declaration(
        &mut self,
        name: &str,
        export: bool,
        parameters: Vec<FormalParameter<'a>>,
        r#type: Option<TSType<'a>>,
        body: ArenaBox<'a, FunctionBody<'a>>,
    ) {
        let declaration = self.function(name, false, None, parameters, r#type, body);
        let statement = if export {
            Statement::new_export_declaration(SPAN, declaration, self)
        } else {
            Statement::from(declaration)
        };
        self.add_statement(statement);
    }

    // Helper to allow for nullable elements.
    pub fn object_literal(
        &self,
        properties: Vec<Option<ObjectPropertyKind<'a>>>,
    ) -> Expression<'a> {
        Expression::new_object_expression(
            SPAN,
            ArenaVec::from_iter_in(properties.into_iter().flatten(), self),
            self,
        )
    }

    pub fn boolean(&self, value: bool) -> Expression<'a> {
        Expression::new_boolean_literal(SPAN, value, self)
    }

    // Helper to create AST from a JSON serializable value. This is really just an
    // ergonomic way to quickly create code less verbosely since the codegen just
    // needs to create the JS value instead of writing all the code to produce the
    // AST.
    pub fn json(&self, value: &Value) -> Expression<'a> {
        match value {
            Value::Null => Expression::new_null_literal(SPAN, self),
            Value::String(value) => self.string_literal(value),
            Value::Number(value) => self.numeric_literal(*value),
            Value::Boolean(value) => self.boolean(*value),
            Value::List(value) => Expression::new_array_expression(
                SPAN,
                ArenaVec::from_iter_in(
                    value
                        .iter()
                        .map(|v| ArrayExpressionElement::from(self.json(v))),
                    self,
                ),
                self,
            ),
            Value::Object(value) => self.object_literal(
                value
                    .iter()
                    .map(|(key, value)| Some(self.property_assignment(key, self.json(value))))
                    .collect(),
            ),
        }
    }

    pub fn const_declaration(
        &mut self,
        name: &str,
        initializer: Expression<'a>,
        r#type: Option<TSType<'a>>,
    ) {
        let statement =
            self.variable_statement(VariableDeclarationKind::Const, name, r#type, initializer);
        self.add_statement(statement);
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
        Codegen::new()
            .with_options(CodegenOptions {
                // Like the TypeScript printer, which escapes non-ASCII
                // characters in string literals.
                ascii_only: true,
                // Like the TypeScript printer.
                indent_char: IndentChar::Space,
                indent_width: 4,
                ..CodegenOptions::default()
            })
            .build(&program)
            .code
    }

    // Given a desired name in the module scope, return a name that is unique. If
    // the name is already taken, a suffix will be added to the name to make it
    // unique.
    //
    // NOTE: This is not truly unique, as it only checks the names that have been
    // generated through this method. In the future we could add more robust
    // scope/name tracking.
    pub fn get_unique_name(&mut self, name: &str) -> String {
        let count = self.global_names.entry(name.to_string()).or_insert(0);
        *count += 1;
        if *count == 1 {
            name.to_string()
        } else {
            format!("{name}_{}", *count - 1)
        }
    }

    // PORT: The helpers below stand in for the `ts.factory` functions used by
    // codegen, where oxc's builder methods don't correspond one-to-one.

    /// `F.createIdentifier(name)` as an expression.
    pub fn identifier(&self, name: &str) -> Expression<'a> {
        Expression::new_identifier(SPAN, Ident::from_str_in(name, self), self)
    }

    /// `F.createStringLiteral(value)`.
    ///
    /// PORT: oxc prints string literals with its own escaping, which differs
    /// from TypeScript's and survives formatting. So this emits the literal
    /// as TypeScript prints it, as the name of an identifier, which oxc
    /// prints verbatim.
    pub fn string_literal(&self, value: &str) -> Expression<'a> {
        self.identifier(&print_string_literal(value))
    }

    /// `F.createNumericLiteral(value)`.
    ///
    /// PORT: TypeScript prints a number as JavaScript's `Number.toString`
    /// does, without a special case for negative or non-finite numbers. As
    /// with `string_literal`, this is emitted verbatim.
    pub fn numeric_literal(&self, value: f64) -> Expression<'a> {
        self.identifier(&value.to_js_string())
    }

    /// `F.createPropertyAssignment(name, initializer)`.
    pub fn property_assignment(
        &self,
        name: &str,
        initializer: Expression<'a>,
    ) -> ObjectPropertyKind<'a> {
        ObjectPropertyKind::new_object_property(
            SPAN,
            PropertyKind::Init,
            self.property_name(name),
            initializer,
            false,
            false,
            false,
            self,
        )
    }

    /// `F.createShorthandPropertyAssignment(name)`.
    pub fn shorthand_property_assignment(&self, name: &str) -> ObjectPropertyKind<'a> {
        ObjectPropertyKind::new_object_property(
            SPAN,
            PropertyKind::Init,
            self.property_name(name),
            self.identifier(name),
            false,
            true,
            false,
            self,
        )
    }

    /// `F.createSpreadAssignment(expression)`.
    pub fn spread_assignment(&self, expression: Expression<'a>) -> ObjectPropertyKind<'a> {
        ObjectPropertyKind::new_spread_property(SPAN, expression, self)
    }

    /// `F.createPropertyAccessExpression(expression, name)`.
    pub fn property_access(&self, expression: Expression<'a>, name: &str) -> Expression<'a> {
        Expression::new_static_member_expression(
            SPAN,
            expression,
            IdentifierName::new(SPAN, Ident::from_str_in(name, self), self),
            false,
            self,
        )
    }

    /// `F.createCallExpression(expression, undefined, args)`.
    pub fn call(&self, callee: Expression<'a>, args: Vec<Expression<'a>>) -> Expression<'a> {
        Expression::new_call_expression(
            SPAN,
            callee,
            None::<ArenaBox<TSTypeParameterInstantiation>>,
            self.arguments(args),
            false,
            self,
        )
    }

    /// `F.createNewExpression(expression, undefined, args)`.
    pub fn new_expression(
        &self,
        callee: Expression<'a>,
        args: Vec<Expression<'a>>,
    ) -> Expression<'a> {
        Expression::new_new_expression(
            SPAN,
            callee,
            None::<ArenaBox<TSTypeParameterInstantiation>>,
            self.arguments(args),
            self,
        )
    }

    /// `F.createArrayLiteralExpression(elements)`.
    pub fn array_literal(&self, elements: Vec<ArrayExpressionElement<'a>>) -> Expression<'a> {
        Expression::new_array_expression(SPAN, ArenaVec::from_iter_in(elements, self), self)
    }

    /// `F.createReturnStatement(expression)`.
    pub fn return_statement(&self, expression: Expression<'a>) -> Statement<'a> {
        Statement::new_return_statement(SPAN, Some(expression), self)
    }

    /// `F.createBlock(statements, true)`.
    pub fn block_statement(&self, statements: Vec<Statement<'a>>) -> Statement<'a> {
        Statement::new_block_statement(SPAN, ArenaVec::from_iter_in(statements, self), self)
    }

    /// `F.createTypeReferenceNode(name, typeArguments)`.
    pub fn type_reference(&self, name: &str, type_arguments: Vec<TSType<'a>>) -> TSType<'a> {
        let type_arguments = if type_arguments.is_empty() {
            None
        } else {
            Some(TSTypeParameterInstantiation::boxed(
                SPAN,
                ArenaVec::from_iter_in(type_arguments, self),
                self,
            ))
        };
        TSType::new_ts_type_reference(
            SPAN,
            TSTypeName::new_identifier_reference(SPAN, Ident::from_str_in(name, self), self),
            type_arguments,
            self,
        )
    }

    /// `F.createVariableStatement` declaring a single variable.
    pub fn variable_statement(
        &self,
        kind: VariableDeclarationKind,
        name: &str,
        r#type: Option<TSType<'a>>,
        initializer: Expression<'a>,
    ) -> Statement<'a> {
        Statement::new_variable_declaration(
            SPAN,
            kind,
            ArenaVec::from_array_in(
                [VariableDeclarator::new(
                    SPAN,
                    BindingPattern::new_binding_identifier(
                        SPAN,
                        Ident::from_str_in(name, self),
                        self,
                    ),
                    r#type.map(|r#type| self.type_annotation(r#type)),
                    Some(initializer),
                    false,
                    self,
                )],
                self,
            ),
            false,
            self,
        )
    }

    /// `F.createFunctionDeclaration`.
    pub fn function(
        &self,
        name: &str,
        is_async: bool,
        type_parameters: Option<Vec<&str>>,
        parameters: Vec<FormalParameter<'a>>,
        r#type: Option<TSType<'a>>,
        body: ArenaBox<'a, FunctionBody<'a>>,
    ) -> Declaration<'a> {
        let type_parameters = type_parameters.map(|type_parameters| {
            TSTypeParameterDeclaration::boxed(
                SPAN,
                ArenaVec::from_iter_in(
                    type_parameters.into_iter().map(|name| {
                        TSTypeParameter::new(
                            SPAN,
                            BindingIdentifier::new(SPAN, Ident::from_str_in(name, self), self),
                            None,
                            None,
                            false,
                            false,
                            false,
                            self,
                        )
                    }),
                    self,
                ),
                self,
            )
        });
        Declaration::new_function_declaration(
            SPAN,
            FunctionType::FunctionDeclaration,
            Some(BindingIdentifier::new(
                SPAN,
                Ident::from_str_in(name, self),
                self,
            )),
            false,
            is_async,
            false,
            type_parameters,
            None::<ArenaBox<TSThisParameter>>,
            self.formal_parameters(parameters),
            r#type.map(|r#type| self.type_annotation(r#type)),
            Some(body),
            self,
        )
    }

    /// A function body, as created by `F.createBlock(statements, true)`.
    pub fn block(&self, statements: Vec<Statement<'a>>) -> ArenaBox<'a, FunctionBody<'a>> {
        FunctionBody::boxed(
            SPAN,
            ArenaVec::new_in(self),
            ArenaVec::from_iter_in(statements, self),
            self,
        )
    }

    fn formal_parameters(
        &self,
        params: Vec<FormalParameter<'a>>,
    ) -> ArenaBox<'a, FormalParameters<'a>> {
        FormalParameters::boxed(
            SPAN,
            FormalParameterKind::FormalParameter,
            ArenaVec::from_iter_in(params, self),
            None::<ArenaBox<FormalParameterRest>>,
            self,
        )
    }

    pub fn type_annotation(&self, r#type: TSType<'a>) -> ArenaBox<'a, TSTypeAnnotation<'a>> {
        TSTypeAnnotation::boxed(SPAN, r#type, self)
    }

    fn arguments(&self, args: Vec<Expression<'a>>) -> ArenaVec<'a, Argument<'a>> {
        ArenaVec::from_iter_in(args.into_iter().map(Argument::from), self)
    }

    /// A property name, which TypeScript's factory functions create from a
    /// string as an identifier.
    pub fn property_name(&self, name: &str) -> PropertyKey<'a> {
        PropertyKey::new_static_identifier(SPAN, Ident::from_str_in(name, self), self)
    }
}

impl<'a> AsMut<TsAstBuilder<'a>> for TsAstBuilder<'a> {
    fn as_mut(&mut self) -> &mut TsAstBuilder<'a> {
        self
    }
}

/// PORT: How TypeScript's printer prints a synthesized string literal:
/// double quoted and escaped by `escapeNonAsciiString`, which escapes
/// characters as `escapeString` does, then escapes every non-ASCII UTF-16
/// code unit.
fn print_string_literal(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('"');
    let mut chars = value.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\t' => out.push_str("\\t"),
            '\u{000B}' => out.push_str("\\v"),
            '\u{000C}' => out.push_str("\\f"),
            '\u{0008}' => out.push_str("\\b"),
            '\r' => out.push_str("\\r"),
            '\n' => out.push_str("\\n"),
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\0' => {
                // An octal escape can't be followed by a digit.
                if chars.peek().is_some_and(char::is_ascii_digit) {
                    out.push_str("\\x00");
                } else {
                    out.push_str("\\0");
                }
            }
            c if c.is_ascii() && !c.is_ascii_control() || c == '\u{7F}' => out.push(c),
            c => {
                // Other control characters, and non-ASCII characters
                // (including U+2028, U+2029 and U+0085, which `escapeString`
                // escapes the same way).
                let mut units = [0; 2];
                for unit in c.encode_utf16(&mut units) {
                    out.push_str(&format!("\\u{unit:04X}"));
                }
            }
        }
    }
    out.push('"');
    out
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

#[cfg(test)]
mod tests {
    use super::print_string_literal;

    // Expected values are from the TypeScript printer.
    #[test]
    fn escapes_string_literals_like_typescript() {
        let cases = [
            ("plain", r#""plain""#),
            ("tab\there", r#""tab\there""#),
            ("quote\"back\\slash", r#""quote\"back\\slash""#),
            ("nul\0x", r#""nul\0x""#),
            ("nul\x001", r#""nul\x001""#),
            ("\u{B}\u{C}\u{8}\r\n", r#""\v\f\b\r\n""#),
            ("\u{1}\u{1F}\u{7F}", "\"\\u0001\\u001F\u{7F}\""),
            ("é😀", r#""\u00E9\uD83D\uDE00""#),
            ("\u{2028}\u{85}", r#""\u2028\u0085""#),
            ("'single'", r#""'single'""#),
        ];
        for (value, expected) in cases {
            assert_eq!(print_string_literal(value), expected, "{value:?}");
        }
    }
}
