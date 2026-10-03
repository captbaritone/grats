//! Extracts GraphQL definitions from a TypeScript file.
//!
//! The extractor reads the file's JSDoc (`jsdoc`), which follows TypeScript's
//! rules, and oxc's AST. Offsets are UTF-8 until locations are made.

use graphql_js::language::ast::{
    ConstDirectiveNode, ConstListValueNode, ConstObjectFieldNode, ConstObjectValueNode,
    ConstValueNode, DefinitionNode, DiagnosticHandle, DiagnosticHandleResult,
    EnumValueDefinitionNode, ExportDefinition, FieldDefinitionNode, InputValueDefinitionNode,
    InputValueDefinitionNodeOrResolverArg, NameNode, NamedTypeNode, ResolverArgument,
    ResolverSignature, StringValueNode, TsIdentifier, TypeNode,
};
use graphql_js::language::parser::{ParseResult, Parser, parse_only};
use graphql_js::language::print_string::print_string;
use graphql_js::language::source::Source;
use graphql_js::r#type::assert_name::assert_name;
use indexmap::IndexMap;
use oxc_ast::AstKind;
use oxc_ast::ast::{
    ArrayExpression, ArrayExpressionElement, BindingIdentifier, BindingPattern, ChainElement,
    Class, ClassElement, ClassType, Declaration, Decorator, Expression, FormalParameter,
    FormalParameterRest, FormalParameters, Function, MethodDefinition, MethodDefinitionKind,
    ObjectExpression, ObjectPattern, ObjectProperty, ObjectPropertyKind, PropertyKey, PropertyKind,
    Statement, StringLiteral, TSAccessibility, TSEnumDeclaration, TSEnumMemberName,
    TSIndexedAccessType, TSInterfaceDeclaration, TSLiteral, TSMethodSignatureKind,
    TSPropertySignature, TSSignature, TSThisParameter, TSType, TSTypeAliasDeclaration,
    TSTypeAnnotation, TSTypeName, TSTypeOperatorOperator, TSTypeParameterInstantiation,
    TSTypeQueryExprName, TSTypeReference, TSUnionType, VariableDeclaration,
    VariableDeclarationKind, VariableDeclarator,
};
use oxc_parser::{Kind, Token};
use oxc_span::{GetSpan, Span};
use oxc_syntax::node::NodeId;
use oxc_syntax::number::ToJsString;
use rustc_hash::{FxHashMap, FxHashSet};

use crate::code_actions as act;
use crate::comments::detect_invalid_comments;
use crate::errors as e;
use crate::files::ParsedFile;
use crate::graphql_constructor as gql;
use crate::grats_config::GratsConfig;
use crate::jsdoc::{
    JSDocComment, JSDocCommentPart, JSDocIndex, JSDocOrTag, SyntaxKind, TagId, TsNodeId,
    get_text_of_js_doc_comment, is_js_white_space, is_line_break, js_trim,
};
use crate::snapshot_refs::{
    DeclLoc, DeclRef, EntityName, EntityNameRef, decl_ref, entity_name_ref,
};
use crate::type_context::{
    DeclarationDefinition, DeclarationDefinitionKind, DerivedResolverDefinition,
    UNRESOLVED_REFERENCE_NAME,
};
use crate::utils::diagnostic_error::{
    CodeFixAction, Diagnostic, DiagnosticRelatedInformation, DiagnosticsResult, TsLocatableNode,
    gql_err, ts_err, ts_related,
};
use crate::utils::helpers::{levenshtein_distance, normalize_newlines, unique_id};
use crate::utils::path;
use crate::utils::result::ok_unless_errors;

pub const LIBRARY_IMPORT_NAME: &str = "grats";
pub const LIBRARY_NAME: &str = "Grats";

pub const TYPE_TAG: &str = "gqlType";
pub const FIELD_TAG: &str = "gqlField";
pub const SCALAR_TAG: &str = "gqlScalar";
pub const INTERFACE_TAG: &str = "gqlInterface";
pub const ENUM_TAG: &str = "gqlEnum";
pub const UNION_TAG: &str = "gqlUnion";
pub const INPUT_TAG: &str = "gqlInput";
pub const DIRECTIVE_TAG: &str = "gqlDirective";
pub const ANNOTATE_TAG: &str = "gqlAnnotate";

pub const QUERY_FIELD_TAG: &str = "gqlQueryField";
pub const MUTATION_FIELD_TAG: &str = "gqlMutationField";
pub const SUBSCRIPTION_FIELD_TAG: &str = "gqlSubscriptionField";

pub const CONTEXT_TAG: &str = "gqlContext";
pub const INFO_TAG: &str = "gqlInfo";

pub const IMPLEMENTS_TAG_DEPRECATED: &str = "gqlImplements";
pub const KILLS_PARENT_ON_EXCEPTION_TAG: &str = "killsParentOnException";

// All the tags that start with gql
pub const ALL_GQL_TAGS: [&str; 12] = [
    TYPE_TAG,
    FIELD_TAG,
    SCALAR_TAG,
    INTERFACE_TAG,
    ENUM_TAG,
    UNION_TAG,
    INPUT_TAG,
    DIRECTIVE_TAG,
    ANNOTATE_TAG,
    QUERY_FIELD_TAG,
    MUTATION_FIELD_TAG,
    SUBSCRIPTION_FIELD_TAG,
];

const DEPRECATED_TAG: &str = "deprecated";
pub const ONE_OF_TAG: &str = "oneOf";

/// `ALL_GQL_TAGS`, `KILLS_PARENT_ON_EXCEPTION_TAG` and `ONE_OF_TAG`, spelled
/// out since arrays can't be concatenated in a `const`.
pub const TAGS: [&str; 14] = [
    TYPE_TAG,
    FIELD_TAG,
    SCALAR_TAG,
    INTERFACE_TAG,
    ENUM_TAG,
    UNION_TAG,
    INPUT_TAG,
    DIRECTIVE_TAG,
    ANNOTATE_TAG,
    QUERY_FIELD_TAG,
    MUTATION_FIELD_TAG,
    SUBSCRIPTION_FIELD_TAG,
    KILLS_PARENT_ON_EXCEPTION_TAG,
    ONE_OF_TAG,
];

pub const OPERATION_TYPES: [&str; 3] = ["Query", "Mutation", "Subscription"];

#[derive(Debug, Default)]
pub struct ExtractionSnapshot {
    pub definitions: Vec<DefinitionNode>,

    /// Map from a GraphQL NameNode to the TypeScript type reference it was
    /// extracted from. Note that at extraction time we don't actually know the
    /// GraphQL name that this references, or if it even references a valid Grats
    /// type. So, the `NameNode` will generally have a placeholder name. This will
    /// be resolved in a later pass since it may reference a type defined in
    /// another file and extraction is done on a per-file basis.
    pub unresolved_names: Vec<(TsIdentifier, EntityNameRef)>,

    /// Map from a TypeScript declaration to the extracted GraphQL name and kind.
    pub name_definitions: Vec<(DeclLoc, NameDefinitionEntry)>,

    /// Some declarations (notably derived context functions) are not actually the
    /// declaration that will become a special GraphQL value, but rather they
    /// _reference_ a type which will implicitly become a special type to Grats.
    pub implicit_name_definitions: Vec<(DeclarationDefinition, EntityNameRef)>,

    /// Records which named GraphQL types define a `__typename` field.
    /// This is used to ensure all types which are members of an abstract type
    /// (union or interface) define a `__typename` field which is required to
    /// determine their GraphQL type at runtime.
    pub types_with_typename: FxHashSet<String>,

    /// TypeScript interfaces which have been used to define GraphQL types. This is
    /// used in a later validation pass to ensure we never use merged interfaces,
    /// since merged interfaces have surprising behaviors which can lead to bugs.
    pub interface_declarations: Vec<DeclRef>,

    /// The diagnostics which `DiagnosticHandle`s in `definitions` refer to.
    pub diagnostics_by_handle: FxHashMap<DiagnosticHandle, Diagnostic>,
}

/// Merges the snapshots of several files. No two files' snapshots share a key.
impl FromIterator<ExtractionSnapshot> for ExtractionSnapshot {
    fn from_iter<I: IntoIterator<Item = ExtractionSnapshot>>(snapshots: I) -> Self {
        let mut result = ExtractionSnapshot::default();
        for snapshot in snapshots {
            result.definitions.extend(snapshot.definitions);
            result.unresolved_names.extend(snapshot.unresolved_names);
            result.name_definitions.extend(snapshot.name_definitions);
            result
                .implicit_name_definitions
                .extend(snapshot.implicit_name_definitions);
            result
                .types_with_typename
                .extend(snapshot.types_with_typename);
            result
                .interface_declarations
                .extend(snapshot.interface_declarations);
            result
                .diagnostics_by_handle
                .extend(snapshot.diagnostics_by_handle);
        }
        result
    }
}

/// A declaration, and what it defines.
#[derive(Debug)]
pub struct NameDefinitionEntry {
    pub declaration: DeclRef,
    pub definition: DeclarationDefinition,
}

/// Extracts GraphQL definitions from TypeScript source code.
///
/// Note that we extract a GraphQL AST with the AST nodes' location information
/// populated with references to the TypeScript code from which the types were
/// derived.
///
/// This ensures that we can apply GraphQL schema validation rules, and any reported
/// errors will point to the correct location in the TypeScript source code.
///
/// `grats_root` is the absolute path which the module paths of resolvers are
/// relative to.
pub fn extract(
    source_file: &ParsedFile,
    config: &GratsConfig,
    grats_root: &str,
) -> DiagnosticsResult<ExtractionSnapshot> {
    Extractor::new(source_file, config, grats_root).extract()
}

struct Extractor<'f, 'a> {
    // Snapshot data. See comments on fields on ExtractionSnapshot for details.
    definitions: Vec<DefinitionNode>,
    unresolved_names: IndexMap<TsIdentifier, EntityNameRef>,
    name_definitions: IndexMap<DeclLoc, NameDefinitionEntry>,
    implicit_name_definitions: Vec<(DeclarationDefinition, EntityNameRef)>,
    types_with_typename: FxHashSet<String>,
    interface_declarations: Vec<DeclRef>,

    errors: Vec<Diagnostic>,
    config: &'f GratsConfig,

    file: &'f ParsedFile<'a>,
    /// The JSDoc of `file`.
    jsdoc: &'f JSDocIndex,
    grats_root: &'f str,
    diagnostics_by_handle: FxHashMap<DiagnosticHandle, Diagnostic>,
}

impl<'f, 'a> Extractor<'f, 'a> {
    fn new(file: &'f ParsedFile<'a>, config: &'f GratsConfig, grats_root: &'f str) -> Self {
        Extractor {
            definitions: Vec::new(),
            unresolved_names: IndexMap::new(),
            name_definitions: IndexMap::new(),
            implicit_name_definitions: Vec::new(),
            types_with_typename: FxHashSet::default(),
            interface_declarations: Vec::new(),
            errors: Vec::new(),
            config,
            file,
            jsdoc: file.jsdoc(),
            grats_root,
            diagnostics_by_handle: FxHashMap::default(),
        }
    }

    fn mark_unresolved_type(&mut self, node: EntityName<'_, 'a>, name: &NameNode) {
        self.unresolved_names
            .insert(name.ts_identifier, entity_name_ref(self.file, node));
    }

    fn record_type_name(
        &mut self,
        node: TsNodeId,
        name: NameNode,
        kind: DeclarationDefinitionKind,
    ) {
        let declaration = decl_ref(self.file, self.ast(node), self.node_span(node));
        self.name_definitions.insert(
            declaration.decl_loc.clone(),
            NameDefinitionEntry {
                declaration,
                definition: DeclarationDefinition {
                    name,
                    kind,
                    derived_context: None,
                },
            },
        );
    }

    // Traverse all nodes, checking each one for its JSDoc tags.
    // If we find a tag we recognize, we extract the relevant information,
    // reporting an error if it is attached to a node where that tag is not
    // supported.
    fn extract(mut self) -> DiagnosticsResult<ExtractionSnapshot> {
        let mut seen_comment_positions: FxHashSet<u32> = FxHashSet::default();
        let jsdoc = self.jsdoc;
        jsdoc.traverse_js_doc_tags(|node, tag| {
            seen_comment_positions.insert(jsdoc.js_doc(tag.js_doc).pos);
            let tag_name = jsdoc.tag(tag).tag_name.text.as_str();
            match tag_name {
                DIRECTIVE_TAG => self.extract_directive(node, tag),
                TYPE_TAG => self.extract_type(node, tag),
                SCALAR_TAG => self.extract_scalar(node, tag),
                INTERFACE_TAG => self.extract_interface(node, tag),
                ENUM_TAG => self.extract_enum(node, tag),
                INPUT_TAG => {
                    if let Some(one_of) = self.find_tag(node, ONE_OF_TAG) {
                        self.report_with(
                            self.tag_span(one_of),
                            "The `@oneOf` tag has been deprecated. Grats will now automatically add the `@oneOf` directive if you define your input type as a TypeScript union. You can remove the `@oneOf` tag.".to_string(),
                            Some(vec![]),
                            Some(CodeFixAction {
                                fix_name: "remove-oneOf-tag".to_string(),
                                description: "Remove @oneOf tag".to_string(),
                                changes: vec![act::remove_node(self.locatable(self.tag_span(one_of)))],
                            }),
                        );
                    } else {
                        self.extract_input(node, tag);
                    }
                }
                UNION_TAG => self.extract_union(node, tag),
                QUERY_FIELD_TAG => self.extract_field(node, tag, Some("Query")),
                MUTATION_FIELD_TAG => self.extract_field(node, tag, Some("Mutation")),
                SUBSCRIPTION_FIELD_TAG => self.extract_field(node, tag, Some("Subscription")),
                FIELD_TAG => self.extract_field(node, tag, None),
                CONTEXT_TAG => {
                    if !jsdoc.is_declaration_statement(node) {
                        self.report(self.tag_span(tag), e::context_tag_on_non_declaration());
                    } else if jsdoc.node(node).kind == SyntaxKind::FunctionDeclaration {
                        self.record_derived_context(node, tag);
                    } else {
                        let name = gql::name(self.locatable(self.tag_span(tag)), "CONTEXT_DUMMY_NAME");
                        self.record_type_name(node, name, DeclarationDefinitionKind::Context);
                    }
                }
                INFO_TAG => {
                    if jsdoc.node(node).kind != SyntaxKind::TypeAliasDeclaration {
                        self.report(self.tag_span(tag), e::user_defined_info_tag());
                    } else {
                        let name = gql::name(self.locatable(self.tag_span(tag)), "INFO_DUMMY_NAME");
                        self.record_type_name(node, name, DeclarationDefinitionKind::Info);
                    }
                }
                KILLS_PARENT_ON_EXCEPTION_TAG => {
                    let field_tags = [
                        FIELD_TAG,
                        QUERY_FIELD_TAG,
                        MUTATION_FIELD_TAG,
                        SUBSCRIPTION_FIELD_TAG,
                    ];
                    if !field_tags.iter().any(|field_tag| self.has_tag(node, field_tag)) {
                        self.report_with(
                            self.tag_name_span(tag),
                            e::kills_parent_on_exception_on_wrong_node(),
                            Some(vec![]),
                            None,
                        );
                    }
                    // TODO: Report invalid location as well
                }
                ANNOTATE_TAG => {
                    // Because we can annotate directives, and directives don't have
                    // any other `@gql` tags, we can't effectively check for unused
                    // annotate tags here.

                    // TODO: Improve validation of miss-placed `@gqlAnnotate` tags.
                }
                "specifiedBy" => {
                    let tag_data = jsdoc.tag(tag);
                    let url = normalize_newlines(&template_string(tag_data.comment.as_ref()))
                        .into_owned();
                    // The tag through its comment, leaving the whitespace (or
                    // `*/`) after it.
                    let end = tag_data
                        .comment_span
                        .map_or(tag_data.tag_name.end, |span| span.end);
                    self.report_with(
                        self.tag_span(tag),
                        e::specified_by_deprecated(),
                        Some(vec![]),
                        Some(CodeFixAction {
                            fix_name: "replace-specifiedBy-with-gqlAnnotate".to_string(),
                            description: "Replace @specifiedBy with @gqlAnnotate".to_string(),
                            changes: vec![act::replace_node(
                                self.locatable(Span::new(tag_data.pos, end)),
                                &format!("@gqlAnnotate specifiedBy(url: {})", print_string(&url)),
                            )],
                        }),
                    );
                }
                IMPLEMENTS_TAG_DEPRECATED => {
                    self.report(self.tag_name_span(tag), e::implements_tag_deprecated());
                }
                _ => {
                    let lower_case_tag = tag_name.to_lowercase();
                    if !lower_case_tag.starts_with("gql") {
                        return;
                    }
                    let (message, fix_name, replacement) = match ALL_GQL_TAGS
                        .into_iter()
                        .find(|t| t.to_lowercase() == lower_case_tag)
                    {
                        Some(t) => (
                            e::wrong_casing_for_grats_tag(tag_name, t),
                            "fix-grats-tag-casing".to_string(),
                            t,
                        ),
                        None => {
                            let suggested = ALL_GQL_TAGS
                                .into_iter()
                                .min_by_key(|t| levenshtein_distance(t, tag_name))
                                .expect("ALL_GQL_TAGS is not empty");
                            (
                                e::invalid_grats_tag(tag_name),
                                format!("change-to-{suggested}"),
                                suggested,
                            )
                        }
                    };
                    self.report_with(
                        self.tag_name_span(tag),
                        message,
                        Some(vec![]),
                        Some(CodeFixAction {
                            fix_name,
                            description: format!("Change to @{replacement}"),
                            changes: vec![act::replace_node(
                                self.locatable(self.tag_name_span(tag)),
                                replacement,
                            )],
                        }),
                    );
                }
            }
        });
        self.errors
            .extend(detect_invalid_comments(self.file, &seen_comment_positions));

        let snapshot = ExtractionSnapshot {
            definitions: self.definitions,
            unresolved_names: self.unresolved_names.into_iter().collect(),
            name_definitions: self.name_definitions.into_iter().collect(),
            implicit_name_definitions: self.implicit_name_definitions,
            types_with_typename: self.types_with_typename,
            interface_declarations: self.interface_declarations,
            diagnostics_by_handle: self.diagnostics_by_handle,
        };
        ok_unless_errors(self.errors, snapshot)
    }

    fn extract_field(&mut self, node: TsNodeId, tag: TagId, parent_type: Option<&str>) {
        let ts_kind = self.jsdoc.node(node).kind;
        match self.kind(node) {
            Some(AstKind::Function(function)) if ts_kind == SyntaxKind::FunctionDeclaration => {
                self.function_declaration_extend_type(node, function, tag, parent_type);
            }
            Some(AstKind::VariableDeclaration(declaration))
                if ts_kind == SyntaxKind::VariableStatement =>
            {
                self.variable_statement_extend_type(node, declaration, tag, parent_type);
            }
            Some(AstKind::MethodDefinition(method)) if is_static_method_definition(method) => {
                self.static_method_extend_type(node, method, tag, parent_type);
            }
            _ => {
                if let Some(parent_type) = parent_type {
                    self.report(
                        self.tag_span(tag),
                        e::root_field_tag_on_wrong_node(parent_type),
                    );
                    return;
                }
                // Non-function fields must be defined as a decent of something that
                // is annotated with @gqlType or @gqlInterface.
                //
                // The actual field will get extracted when we traverse the parent, but
                // we need to report an error if the parent is not a valid type or is not
                // annotated with @gqlType or @gqlInterface. Otherwise, the user may get
                // confused as to why the field is not showing up in the schema.
                let parent = self.get_field_parent(node);

                match parent {
                    // If there was no valid parent, report an error.
                    None => {
                        self.report_unhandled(
                            self.node_span(node),
                            "field",
                            e::field_tag_on_wrong_node(),
                            None,
                        );
                    }
                    Some(parent) if self.has_tag(parent, INPUT_TAG) => {
                        // You don't need to add `@gqlField` to input types, but it's an
                        // easy mistake to think you might need to. We report a helpful
                        // error in this case and offer a fix.
                        let docblock = self.jsdoc.js_doc(tag.js_doc);
                        let is_only_tag = docblock.tags.len() == 1 && docblock.comment.is_none();

                        let action = if is_only_tag {
                            act::remove_node(self.locatable(Span::new(docblock.pos, docblock.end)))
                        } else {
                            act::remove_node(self.locatable(self.tag_span(tag)))
                        };
                        self.report_with(
                            self.tag_span(tag),
                            e::gql_field_tag_on_input_type(),
                            Some(vec![]),
                            Some(CodeFixAction {
                                fix_name: "remove-gql-field-from-input".to_string(),
                                description: "Remove @gqlField tag".to_string(),
                                changes: vec![action],
                            }),
                        );
                    }
                    Some(parent)
                        if !self.has_tag(parent, TYPE_TAG)
                            && !self.has_tag(parent, INTERFACE_TAG) =>
                    {
                        self.report(self.tag_name_span(tag), e::gql_field_parent_missing_tag());
                    }
                    Some(_) => {}
                }
            }
        }
    }

    /// The declaration which a field could belong to, read from the JSDoc
    /// index's nodes, whose kinds and parents are TypeScript's.
    fn get_field_parent(&self, node: TsNodeId) -> Option<TsNodeId> {
        let node_data = self.jsdoc.node(node);
        let parent = node_data.parent?;
        let parent_data = self.jsdoc.node(parent);
        match (node_data.kind, parent_data.kind) {
            (
                SyntaxKind::MethodDeclaration
                | SyntaxKind::GetAccessor
                | SyntaxKind::PropertyDeclaration,
                _,
            ) => Some(parent),
            (SyntaxKind::Parameter, SyntaxKind::Constructor) => parent_data.parent,
            (
                SyntaxKind::PropertySignature | SyntaxKind::MethodSignature,
                SyntaxKind::TypeLiteral,
            ) => parent_data.parent.filter(|&grandparent| {
                self.jsdoc.node(grandparent).kind == SyntaxKind::TypeAliasDeclaration
            }),
            (
                SyntaxKind::PropertySignature | SyntaxKind::MethodSignature,
                SyntaxKind::InterfaceDeclaration,
            ) => Some(parent),
            _ => None,
        }
    }

    fn extract_interface(&mut self, node: TsNodeId, tag: TagId) {
        if let Some(AstKind::TSInterfaceDeclaration(decl)) = self.kind(node) {
            self.interface_interface_declaration(node, decl, tag);
        } else {
            self.report(self.tag_span(tag), e::invalid_interface_tag_usage());
        }
    }

    fn extract_union(&mut self, node: TsNodeId, tag: TagId) {
        if let Some(AstKind::TSTypeAliasDeclaration(decl)) = self.kind(node) {
            self.union_type_alias_declaration(node, decl, tag);
        } else {
            self.report(self.tag_span(tag), e::invalid_union_tag_usage());
        }
    }

    fn extract_input(&mut self, node: TsNodeId, tag: TagId) {
        match self.kind(node) {
            Some(AstKind::TSTypeAliasDeclaration(decl)) => {
                self.input_type_alias_declaration(node, decl, tag);
            }
            Some(AstKind::TSInterfaceDeclaration(decl)) => {
                self.input_interface_declaration(node, decl, tag);
            }
            _ => self.report(self.tag_span(tag), e::invalid_input_tag_usage()),
        }
    }

    fn record_derived_context(&mut self, node: TsNodeId, tag: TagId) {
        let AstKind::Function(function) = self.ast(node) else {
            unreachable!("Expected a function declaration")
        };
        let Some(return_type) = &function.return_type else {
            return self.report(
                self.node_span(node),
                e::missing_return_type_for_derived_resolver(),
            );
        };

        // Check if the return type is Promise<T> and unwrap it
        let Some(UnwrappedType {
            r#type: inner_type,
            is_async,
        }) = self.maybe_unwrap_promise_type(&return_type.type_annotation)
        else {
            return;
        };

        let TSType::TSTypeReference(inner_type) = inner_type else {
            return self.report(
                inner_type.span(),
                e::missing_return_type_for_derived_resolver(),
            );
        };

        let func_name = self.named_function_export_name(node, function);

        if !self.is_top_level(node) {
            return self.report(self.node_span(node), e::function_field_not_top_level());
        }

        let ts_module_path = path::relative(self.grats_root, &self.file.path);

        let Some((resolver_params, _)) =
            self.resolver_params(&params(function.this_param.as_deref(), &function.params))
        else {
            return;
        };

        let name = gql::name(self.locatable(self.tag_span(tag)), "CONTEXT_DUMMY_NAME");
        self.implicit_name_definitions.push((
            DeclarationDefinition {
                name,
                kind: DeclarationDefinitionKind::DerivedContext,
                derived_context: Some(DerivedResolverDefinition {
                    path: ts_module_path,
                    export_name: func_name.map(|(_, name)| name.to_string()),
                    args: resolver_params,
                    r#async: is_async,
                }),
            },
            entity_name_ref(self.file, EntityName::TypeReference(inner_type)),
        ));
    }

    /// Whether the comment can be parsed by `parse_tag_gql`, which reads the
    /// tag's source text. Reports any links in it.
    fn check_docblock_tag_comment(&mut self, comment: &JSDocComment) -> bool {
        let JSDocComment::Parts(parts) = comment else {
            return true;
        };
        let mut is_text = true;
        for part in parts {
            if let JSDocCommentPart::Link { pos, end, .. } = part {
                self.report(Span::new(*pos, *end), e::directive_tag_comment_not_text());
                is_text = false;
            }
        }
        is_text
    }

    fn extract_directive(&mut self, node: TsNodeId, tag: TagId) {
        match self.kind(node) {
            Some(AstKind::Function(function))
                if self.jsdoc.node(node).kind == SyntaxKind::FunctionDeclaration =>
            {
                self.extract_directive_function(node, function, tag);
            }
            _ => self.report(self.tag_span(tag), e::directive_tag_on_wrong_node()),
        }
    }

    fn extract_directive_function(
        &mut self,
        node: TsNodeId,
        function: &'a Function<'a>,
        tag: TagId,
    ) {
        let description = self.collect_description(node);

        let args = self.extract_directive_args(function);

        let jsdoc = self.jsdoc;
        let Some(tag_comment) = &jsdoc.tag(tag).comment else {
            self.report(self.tag_span(tag), e::directive_tag_no_comment());
            return;
        };
        if !self.check_docblock_tag_comment(tag_comment) {
            return;
        }

        let tag_data = self.parse_tag_gql(tag, |parser| {
            let mut name: Option<NameNode> = None;
            let mut repeatable = parser.expect_optional_keyword("repeatable")?;
            let on = parser.expect_optional_keyword("on")?;

            // If the first identifier was neither `repeatable` nor `on`, then
            // we expect it to be the directive name.
            if !on && !repeatable {
                name = Some(parser.parse_name()?);
                repeatable = parser.expect_optional_keyword("repeatable")?;
                parser.expect_keyword("on")?;
            }

            let locations = parser.parse_directive_locations()?;
            Ok((name, repeatable, locations))
        });

        let Some((name, repeatable, locations)) = tag_data else {
            return;
        };

        // If there wasn't a name in the directive tag, we expect the function
        // to be named.
        let name = match name {
            Some(name) => name,
            None => {
                let Some(id) = &function.id else {
                    return self.report(self.node_span(node), e::directive_function_not_named());
                };
                let Some((id_span, id)) = self.expect_name_identifier(binding_name(id)) else {
                    return;
                };
                gql::name(self.locatable(id_span), id)
            }
        };

        let definition = gql::directive_definition(
            self.locatable(self.node_span(node)),
            name,
            args,
            repeatable,
            locations,
            description,
        );
        self.definitions
            .push(DefinitionNode::DirectiveDefinition(definition));
    }

    fn extract_directive_args(
        &mut self,
        node: &'a Function<'a>,
    ) -> Option<Vec<InputValueDefinitionNode>> {
        // Additional arguments are ignored.
        let param = *params(node.this_param.as_deref(), &node.params).first()?;
        let Some(param_type) = param.type_annotation() else {
            self.report(param.span(), e::directive_argument_not_object());
            return None;
        };
        if matches!(param_type.type_annotation, TSType::TSNeverKeyword(_)) {
            return None;
        }
        let TSType::TSTypeLiteral(literal) = &param_type.type_annotation else {
            self.report(param.span(), e::directive_argument_not_object());
            return None;
        };
        let defaults = if let Param::Item(item) = param
            && let BindingPattern::ObjectPattern(pattern) = &item.pattern
        {
            Some(self.collect_arg_defaults(pattern))
        } else {
            None
        };
        let args = literal
            .members
            .iter()
            .filter_map(|member| self.collect_arg(member, defaults.as_ref()))
            .collect();
        Some(args)
    }

    fn extract_type(&mut self, node: TsNodeId, tag: TagId) {
        match self.kind(node) {
            Some(AstKind::Class(class)) if class.r#type == ClassType::ClassDeclaration => {
                self.type_class_declaration(node, class, tag);
            }
            Some(AstKind::TSInterfaceDeclaration(decl)) => {
                self.type_interface_declaration(node, decl, tag);
            }
            Some(AstKind::TSTypeAliasDeclaration(decl)) => {
                self.type_type_alias_declaration(node, decl, tag);
            }
            _ => self.report(self.tag_span(tag), e::invalid_type_tag_usage()),
        }
    }

    fn extract_scalar(&mut self, node: TsNodeId, tag: TagId) {
        if let Some(AstKind::TSTypeAliasDeclaration(decl)) = self.kind(node) {
            self.scalar_type_alias_declaration(node, decl, tag);
        } else {
            self.report(self.tag_span(tag), e::invalid_scalar_tag_usage());
        }
    }

    fn extract_enum(&mut self, node: TsNodeId, tag: TagId) {
        match self.kind(node) {
            Some(AstKind::TSEnumDeclaration(decl)) => {
                self.enum_enum_declaration(node, decl, tag);
            }
            Some(AstKind::TSTypeAliasDeclaration(decl)) => {
                self.enum_type_alias_declaration(node, decl, tag);
            }
            _ => self.report(self.tag_span(tag), e::invalid_enum_tag_usage()),
        }
    }

    /// Reports an error at `span`.
    fn report(&mut self, span: Span, message: String) {
        self.report_with(span, message, None, None);
    }

    /// Reports an error at `span`, with related information and a fix.
    fn report_with(
        &mut self,
        span: Span,
        message: String,
        related_information: Option<Vec<DiagnosticRelatedInformation>>,
        fix: Option<CodeFixAction>,
    ) {
        let node = self.locatable(span);
        self.errors
            .push(ts_err(node, message, related_information, fix));
    }

    fn find_tag(&mut self, node: TsNodeId, tag_name: &str) -> Option<TagId> {
        let tags: Vec<TagId> = self
            .jsdoc
            .get_js_doc_tags(node)
            .into_iter()
            .filter(|&tag| self.jsdoc.tag(tag).tag_name.text == tag_name)
            .collect();

        let (first, additional) = tags.split_first()?;
        if !additional.is_empty() {
            let additional_tags = additional
                .iter()
                .map(|&tag| {
                    ts_related(
                        self.locatable(self.tag_span(tag)),
                        "Additional tag".to_string(),
                    )
                })
                .collect();

            self.report_with(
                self.tag_span(*first),
                e::duplicate_tag(tag_name),
                Some(additional_tags),
                Some(CodeFixAction {
                    fix_name: "remove-duplicate-tag".to_string(),
                    description: format!("Remove duplicate @{tag_name} tag"),
                    changes: additional
                        .iter()
                        .map(|&tag| act::remove_node(self.locatable(self.tag_span(tag))))
                        .collect(), // Remove all but the first tag
                }),
            );
            return None;
        }
        Some(*first)
    }

    fn has_tag(&self, node: TsNodeId, tag_name: &str) -> bool {
        self.jsdoc
            .get_js_doc_tags(node)
            .into_iter()
            .any(|tag| self.jsdoc.tag(tag).tag_name.text == tag_name)
    }

    /// A span in this file, as a node which diagnostics can locate.
    fn locatable(&self, span: Span) -> TsLocatableNode<'f> {
        TsLocatableNode::new(self.file, span)
    }

    /// The span of a JSDoc tag, from its `@`.
    fn tag_span(&self, tag: TagId) -> Span {
        let tag = self.jsdoc.tag(tag);
        Span::new(tag.pos, tag.end)
    }

    /// The span of a JSDoc tag's name, after its `@`.
    fn tag_name_span(&self, tag: TagId) -> Span {
        let tag_name = &self.jsdoc.tag(tag).tag_name;
        Span::new(tag_name.pos, tag_name.end)
    }
}

impl<'f, 'a> Extractor<'f, 'a> {
    // Report an error that we don't know how to infer a type, but it's possible that we should.
    // Gives the user a path forward if they think we should be able to infer this type.
    fn report_unhandled(
        &mut self,
        span: Span,
        position_kind: &str,
        message: String,
        related_information: Option<Vec<DiagnosticRelatedInformation>>,
    ) {
        let suggestion = format!(
            "If you think {LIBRARY_NAME} should be able to infer this {position_kind}, please report an issue at {}.",
            e::ISSUE_URL
        );
        let completed_message = format!("{message}\n\n{suggestion}");
        self.report_with(span, completed_message, related_information, None);
    }

    /* TypeScript traversals */

    fn union_type_alias_declaration(
        &mut self,
        node: TsNodeId,
        decl: &'a TSTypeAliasDeclaration<'a>,
        tag: TagId,
    ) {
        let Some(name) = self.entity_name(self.node_span(node), Some(binding_name(&decl.id)), tag)
        else {
            return;
        };

        let mut types: Vec<NamedTypeNode> = Vec::new();
        match &decl.type_annotation {
            TSType::TSUnionType(union) => {
                for member in &union.types {
                    let TSType::TSTypeReference(member) = member else {
                        return self.report_unhandled(
                            member.span(),
                            "union member",
                            e::expected_union_type_reference(),
                            None,
                        );
                    };
                    types.push(self.union_member_declaration(member));
                }
            }
            TSType::TSTypeReference(member) => types.push(self.union_member_declaration(member)),
            _ => {
                return self.report(self.node_span(node), e::expected_union_type_node());
            }
        }

        let description = self.collect_description(node);

        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::Union);

        let directives = self.collect_directives(node);

        let definition = gql::union_type_definition(
            self.locatable(self.node_span(node)),
            name,
            types,
            description,
            Some(directives),
        );
        self.definitions
            .push(DefinitionNode::UnionTypeDefinition(definition));
    }

    fn union_member_declaration(&mut self, member: &'a TSTypeReference<'a>) -> NamedTypeNode {
        let named_type = gql::named_type(
            self.locatable(member.type_name.span()),
            UNRESOLVED_REFERENCE_NAME,
        );
        self.mark_unresolved_type(EntityName::TypeReference(member), &named_type.name);
        named_type
    }

    fn variable_statement_extend_type(
        &mut self,
        node: TsNodeId,
        statement: &'a VariableDeclaration<'a>,
        tag: TagId,
        parent_type: Option<&str>,
    ) {
        if statement.declarations.len() != 1 {
            return self.report(
                self.node_span(node),
                e::exported_field_variable_multiple_declarations(statement.declarations.len()),
            );
        }
        let declaration = &statement.declarations[0];

        // Like TypeScript, which flags `await using` declarations as `const`.
        if !matches!(
            statement.kind,
            VariableDeclarationKind::Const | VariableDeclarationKind::AwaitUsing
        ) {
            // Looks like there's no good way to find the location range of the `let`
            // or `var` keyword.
            return self.report(
                self.node_span(self.declaration_list(node)),
                e::exported_arrow_function_not_const(),
            );
        }

        let func_name = self.expect_name_identifier(pattern_name(&declaration.id));
        let Some(name) =
            self.entity_name(declaration.span, Some(pattern_name(&declaration.id)), tag)
        else {
            return;
        };

        if !self.is_top_level(node) {
            return self.report(
                self.node_span(node),
                e::field_variable_not_top_level_exported(),
            );
        }

        let Some(Expression::ArrowFunctionExpression(initializer)) = &declaration.init else {
            return self.report(
                self.node_span(node),
                e::field_variable_is_not_arrow_function(),
            );
        };

        if self.export_kind(node).is_none() {
            return self.report_with(
                declaration.id.span(),
                e::field_variable_not_top_level_exported(),
                Some(vec![]),
                Some(CodeFixAction {
                    fix_name: "add-export-keyword-to-arrow-function".to_string(),
                    description: "Add export keyword to exported arrow function with @gqlField"
                        .to_string(),
                    changes: vec![act::prefix_node(
                        self.locatable(self.node_span(node)),
                        "export ",
                    )],
                }),
            );
        }

        let initializer = FunctionLike {
            id: self.ts(initializer.node_id()),
            params: params(None, &initializer.params),
            return_type: initializer.return_type.as_deref(),
        };
        self.collect_abstract_field(initializer, func_name, None, name, parent_type);
    }

    fn function_declaration_extend_type(
        &mut self,
        node: TsNodeId,
        function: &'a Function<'a>,
        tag: TagId,
        parent_type: Option<&str>,
    ) {
        let func_name = self.named_function_export_name(node, function);
        let Some(name) = self.entity_name(
            self.node_span(node),
            function.id.as_ref().map(binding_name),
            tag,
        ) else {
            return;
        };

        if !self.is_top_level(node) {
            return self.report(self.node_span(node), e::function_field_not_top_level());
        }

        let function = FunctionLike {
            id: node,
            params: params(function.this_param.as_deref(), &function.params),
            return_type: function.return_type.as_deref(),
        };
        self.collect_abstract_field(function, func_name, None, name, parent_type);
    }

    fn static_method_extend_type(
        &mut self,
        node: TsNodeId,
        method: &'a MethodDefinition<'a>,
        tag: TagId,
        parent_type: Option<&str>,
    ) {
        let Some((_, method_name)) =
            self.expect_name_identifier(key_name(self.file, &method.key, method.computed))
        else {
            return;
        };

        let Some(name) = self.entity_name(
            self.node_span(node),
            Some(key_name(self.file, &method.key, method.computed)),
            tag,
        ) else {
            return;
        };

        let class_node = self
            .jsdoc
            .node(node)
            .parent
            .expect("Expected a method to have a parent");

        let field_defined_here = || {
            vec![ts_related(
                self.locatable(self.tag_span(tag)),
                "Field defined here".to_string(),
            )]
        };

        let class = match self.kind(class_node) {
            Some(AstKind::Class(class))
                if self.jsdoc.node(class_node).kind == SyntaxKind::ClassDeclaration =>
            {
                class
            }
            _ => {
                let related = field_defined_here();
                return self.report_with(
                    self.node_span(class_node),
                    e::static_method_on_non_class(),
                    Some(related),
                    None,
                );
            }
        };
        let class_blame_node = class
            .id
            .as_ref()
            .map_or(self.node_span(class_node), |id| id.span);

        if !self.is_top_level(class_node) {
            let related = field_defined_here();
            return self.report_with(
                class_blame_node,
                e::static_method_class_not_top_level(),
                Some(related),
                None,
            );
        }

        let Some(is_default) = self.export_kind(class_node) else {
            let related = field_defined_here();
            return self.report_with(
                class_blame_node,
                e::static_method_field_class_not_exported(),
                Some(related),
                Some(CodeFixAction {
                    fix_name: "add-export-keyword-to-class".to_string(),
                    description: "Add export keyword to class with static @gqlField".to_string(),
                    changes: vec![act::prefix_node(
                        self.locatable(self.node_span(class_node)),
                        "export ",
                    )],
                }),
            );
        };

        let export_name = if is_default {
            None
        } else {
            let Some(class_name) = &class.id else {
                let related = field_defined_here();
                return self.report_with(
                    class_blame_node,
                    e::static_method_class_with_named_export_not_named(),
                    Some(related),
                    None,
                );
            };
            let Some(class_name) = self.expect_name_identifier(binding_name(class_name)) else {
                return;
            };
            Some(class_name)
        };

        let method = FunctionLike {
            id: node,
            params: params(method.value.this_param.as_deref(), &method.value.params),
            return_type: method.value.return_type.as_deref(),
        };
        self.collect_abstract_field(method, export_name, Some(method_name), name, parent_type);
    }

    /// Runs the parser code in `cb` over the text of `tag`, after its name, and
    /// reports any syntax error.
    ///
    /// The text is parsed where it is in the file, so that locations point into
    /// the docblock. The lexer ignores the `*`s which prefix its lines.
    fn parse_tag_gql<T>(
        &mut self,
        tag: TagId,
        cb: impl FnOnce(&mut Parser) -> ParseResult<T>,
    ) -> Option<T> {
        let tag_data = self.jsdoc.tag(tag);
        let start = tag_data.tag_name.end;
        let text = &self.file.text[start as usize..tag_data.end as usize];
        let source = Source::docblock(text, self.file.source, self.file.offsets.to_utf16(start));
        match parse_only(source, cb) {
            Ok(result) => Some(result),
            Err(err) => {
                // Errors at the end of the text, like a missing name, have
                // empty locations, so they're reported at the whole tag.
                let span = match err.nodes.first() {
                    Some(Some(loc)) if loc.start < loc.end => Span::new(
                        self.file.offsets.to_utf8(loc.start),
                        self.file.offsets.to_utf8(loc.end),
                    ),
                    _ => self.tag_span(tag),
                };
                self.report(span, err.message);
                None
            }
        }
    }

    fn collect_directives(&mut self, node: TsNodeId) -> Vec<ConstDirectiveNode> {
        let mut directives: Vec<ConstDirectiveNode> = Vec::new();
        for tag in self.jsdoc.get_js_doc_tags(node) {
            let jsdoc = self.jsdoc;
            let tag_data = jsdoc.tag(tag);
            if tag_data.tag_name.text != ANNOTATE_TAG {
                continue;
            }
            let Some(JSDocComment::Text(_)) = &tag_data.comment else {
                self.report(
                    self.tag_span(tag),
                    "Expected docblock tag to have a value.".to_string(),
                );
                continue;
            };
            let directive =
                self.parse_tag_gql(tag, |parser| parser.parse_const_directive_without_at());
            if let Some(directive) = directive {
                directives.push(ConstDirectiveNode {
                    loc: Some(self.locatable(self.tag_span(tag)).loc()),
                    ..directive
                });
            }
        }

        if let Some(tag) = self.find_tag(node, DEPRECATED_TAG) {
            let tag_data = self.jsdoc.tag(tag);
            let reason = tag_data.comment_span.and_then(|comment_span| {
                let reason =
                    normalize_newlines(&get_text_of_js_doc_comment(tag_data.comment.as_ref())?)
                        .into_owned();
                let tag_node = self.locatable(self.tag_span(tag));
                Some(gql::const_argument(
                    tag_node,
                    gql::name(tag_node, "reason"),
                    ConstValueNode::StringValue(gql::string(
                        self.locatable(comment_span),
                        &reason,
                        false,
                    )),
                ))
            });

            directives.push(gql::const_directive(
                self.locatable(self.tag_name_span(tag)),
                gql::name(self.locatable(self.node_span(node)), DEPRECATED_TAG),
                reason.map(|reason| vec![reason]),
            ));
        }

        directives
    }

    fn collect_abstract_field(
        &mut self,
        node: FunctionLike<'a>,
        export_name: Option<(Span, &'a str)>,
        method_name: Option<&'a str>,
        name: NameNode,
        parent_type: Option<&str>,
    ) {
        let Some(node_type) = node.return_type else {
            // TODO: Make error generic
            self.errors.push(gql_err(
                name.loc,
                e::invalid_return_type_for_function_field(),
                None,
            ));
            return;
        };

        let Some(args) = self.collect_abstract_field_args(&node, &name, parent_type) else {
            return;
        };

        let Some(r#type) = self.collect_type(&node_type.type_annotation, FieldTypeContext::Output)
        else {
            return;
        };

        let ts_module_path = path::relative(self.grats_root, &self.file.path);

        let directives = self.collect_directives(node.id);

        let description = self.collect_description(node.id);

        let kills_parent_on_exception = self.kills_parent_on_exception(node.id);

        let export_name = export_name.map(|(_, export_name)| export_name.to_string());
        let field = gql::field_definition(
            self.locatable(self.node_span(node.id)),
            name,
            r#type,
            args.args,
            directives,
            description,
            kills_parent_on_exception,
            match method_name {
                None => ResolverSignature::Function {
                    path: ts_module_path,
                    export_name,
                    arguments: Some(args.resolver_params),
                },
                Some(method_name) => ResolverSignature::StaticMethod {
                    path: ts_module_path,
                    export_name,
                    arguments: Some(args.resolver_params),
                    name: method_name.to_string(),
                },
            },
        );
        let definition = gql::abstract_field_definition(
            self.locatable(self.node_span(node.id)),
            args.type_name,
            field,
            parent_type.is_none(),
        );
        self.definitions
            .push(DefinitionNode::ObjectTypeExtension(definition));
    }

    fn collect_abstract_field_args(
        &mut self,
        node: &FunctionLike<'a>,
        name: &NameNode,
        parent_type: Option<&str>,
    ) -> Option<AbstractFieldArgs> {
        if let Some(parent_type) = parent_type {
            let (resolver_params, args) = self.resolver_params(&node.params)?;
            return Some(AbstractFieldArgs {
                args,
                resolver_params,
                type_name: gql::name(self.locatable(self.node_span(node.id)), parent_type),
            });
        }

        // If the typename is not hard coded, we must infer it from the initial parameter
        let Some((&type_param, rest_params)) = node.params.split_first() else {
            // TODO: Make error generic
            self.errors.push(gql_err(
                name.loc,
                e::invalid_parent_arg_for_function_field(),
                None,
            ));
            return None;
        };
        let type_name = self.type_reference_from_param(type_param)?;
        let (params, args) = self.resolver_params(rest_params)?;

        let source = ResolverArgument::Source {
            loc: Some(self.locatable(type_param.span()).loc()),
        };
        let resolver_params = std::iter::once(source).chain(params).collect();
        Some(AbstractFieldArgs {
            type_name,
            args,
            resolver_params,
        })
    }

    fn type_reference_from_param(&mut self, type_param: Param<'a>) -> Option<NameNode> {
        let Some(param_type) = type_param.type_annotation() else {
            self.report(type_param.span(), e::function_field_parent_type_missing());
            return None;
        };
        let TSType::TSTypeReference(reference) = &param_type.type_annotation else {
            self.report(
                param_type.type_annotation.span(),
                e::function_field_parent_type_not_valid(),
            );
            return None;
        };

        let type_name = gql::name(
            self.locatable(reference.type_name.span()),
            UNRESOLVED_REFERENCE_NAME,
        );
        self.mark_unresolved_type(EntityName::TypeReference(reference), &type_name);
        Some(type_name)
    }

    // A little awkward that null here is both semantic or an indication of an error.
    fn named_function_export_name(
        &mut self,
        node: TsNodeId,
        function: &'a Function<'a>,
    ) -> Option<(Span, &'a str)> {
        let Some(id) = &function.id else {
            self.report(self.node_span(node), e::function_field_not_named());
            return None;
        };
        let Some(is_default) = self.export_kind(node) else {
            self.report_with(
                id.span,
                e::function_field_not_named_export(),
                Some(vec![]),
                Some(CodeFixAction {
                    fix_name: "add-export-keyword-to-function".to_string(),
                    description: "Add export keyword to function with @gqlField".to_string(),
                    changes: vec![act::prefix_node(
                        self.locatable(self.node_span(node)),
                        "export ",
                    )],
                }),
            );
            return None;
        };

        (!is_default).then_some((id.span, id.name.as_str()))
    }

    fn scalar_type_alias_declaration(
        &mut self,
        node: TsNodeId,
        decl: &'a TSTypeAliasDeclaration<'a>,
        tag: TagId,
    ) {
        let Some(name) = self.entity_name(self.node_span(node), Some(binding_name(&decl.id)), tag)
        else {
            return;
        };

        let description = self.collect_description(node);
        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::Scalar);

        let directives = self.collect_directives(node);

        if self.export_kind(node).is_none() {
            self.report_with(
                decl.id.span,
                e::scalar_not_exported(),
                Some(vec![]),
                Some(CodeFixAction {
                    fix_name: "add-export-keyword-to-scalar".to_string(),
                    description: "Add export keyword to type alias with @gqlScalar".to_string(),
                    changes: vec![act::prefix_node(
                        self.locatable(self.node_span(node)),
                        "export ",
                    )],
                }),
            );
        }

        let exported = ExportDefinition {
            ts_module_path: path::relative(self.grats_root, &self.file.path),
            export_name: Some(decl.id.name.to_string()),
        };

        let definition = gql::scalar_type_definition(
            self.locatable(self.node_span(node)),
            name,
            Some(directives),
            description,
            Some(exported),
        );
        self.definitions
            .push(DefinitionNode::ScalarTypeDefinition(definition));
    }

    fn input_type_alias_declaration(
        &mut self,
        node: TsNodeId,
        decl: &'a TSTypeAliasDeclaration<'a>,
        tag: TagId,
    ) {
        let Some(name) = self.entity_name(self.node_span(node), Some(binding_name(&decl.id)), tag)
        else {
            return;
        };

        let description = self.collect_description(node);
        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::InputObject);

        let mut directives = self.collect_directives(node);
        let fields = if let TSType::TSUnionType(union) = &decl.type_annotation {
            directives.push(gql::const_directive(
                self.locatable(self.node_span(node)),
                gql::name(self.locatable(union.span), ONE_OF_TAG),
                Some(vec![]),
            ));
            Some(self.extract_one_of_input_fields(&union.types))
        } else {
            self.collect_input_fields(node, decl)
        };

        let Some(fields) = fields else { return };

        let definition = gql::input_object_type_definition(
            self.locatable(self.node_span(node)),
            name,
            Some(fields),
            Some(directives),
            description,
        );
        self.definitions
            .push(DefinitionNode::InputObjectTypeDefinition(definition));
    }

    fn input_interface_declaration(
        &mut self,
        node: TsNodeId,
        decl: &'a TSInterfaceDeclaration<'a>,
        tag: TagId,
    ) {
        let Some(name) = self.entity_name(self.node_span(node), Some(binding_name(&decl.id)), tag)
        else {
            return;
        };

        let description = self.collect_description(node);
        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::InputObject);

        let fields = self.collect_input_field_signatures(&decl.body.body);

        self.interface_declarations
            .push(decl_ref(self.file, self.ast(node), self.node_span(node)));

        let directives = self.collect_directives(node);

        let definition = gql::input_object_type_definition(
            self.locatable(self.node_span(node)),
            name,
            Some(fields),
            Some(directives),
            description,
        );
        self.definitions
            .push(DefinitionNode::InputObjectTypeDefinition(definition));
    }

    fn extract_one_of_input_fields(
        &mut self,
        types: &'a [TSType<'a>],
    ) -> Vec<InputValueDefinitionNode> {
        types
            .iter()
            .filter_map(|member| self.collect_one_of_input_field(member))
            .collect()
    }

    fn collect_one_of_input_field(
        &mut self,
        node: &'a TSType<'a>,
    ) -> Option<InputValueDefinitionNode> {
        let TSType::TSTypeLiteral(literal) = node else {
            self.report(
                node.span(),
                e::one_of_field_not_type_literal_with_one_property(),
            );
            return None;
        };
        let [property] = literal.members.as_slice() else {
            self.report(
                node.span(),
                e::one_of_field_not_type_literal_with_one_property(),
            );
            return None;
        };
        let TSSignature::TSPropertySignature(property) = property else {
            self.report(
                property.span(),
                e::one_of_field_not_type_literal_with_one_property(),
            );
            return None;
        };

        let Some(property_type) = &property.type_annotation else {
            self.report(property.span, e::one_of_property_missing_type_annotation());
            return None;
        };

        let description = self.collect_description(self.ts(property.node_id()));
        let (name_span, name) =
            self.expect_name_identifier(key_name(self.file, &property.key, property.computed))?;

        let inner = self.collect_type(&property_type.type_annotation, FieldTypeContext::Input)?;

        // All fields must be nullable since only one will be present at a time.
        let r#type = gql::nullable_type(inner);
        Some(gql::input_value_definition(
            self.locatable(node.span()),
            gql::name(self.locatable(name_span), name),
            r#type.into(),
            Some(vec![]),
            None,
            description,
        ))
    }

    fn collect_input_fields(
        &mut self,
        node: TsNodeId,
        decl: &'a TSTypeAliasDeclaration<'a>,
    ) -> Option<Vec<InputValueDefinitionNode>> {
        let TSType::TSTypeLiteral(literal) = &decl.type_annotation else {
            self.report_unhandled(
                self.node_span(node),
                "input",
                e::input_type_not_literal(),
                None,
            );
            return None;
        };
        let fields = self.collect_input_field_signatures(&literal.members);
        (!fields.is_empty()).then_some(fields)
    }

    /// The input fields of an input type's members, reporting any which
    /// aren't property signatures.
    fn collect_input_field_signatures(
        &mut self,
        members: &'a [TSSignature<'a>],
    ) -> Vec<InputValueDefinitionNode> {
        members
            .iter()
            .filter_map(|member| {
                let TSSignature::TSPropertySignature(member) = member else {
                    self.report_unhandled(
                        member.span(),
                        "input field",
                        e::input_type_field_not_property(),
                        None,
                    );
                    return None;
                };
                self.collect_input_field(member)
            })
            .collect()
    }

    fn collect_input_field(
        &mut self,
        node: &'a TSPropertySignature<'a>,
    ) -> Option<InputValueDefinitionNode> {
        let (id_span, id) =
            self.expect_name_identifier(key_name(self.file, &node.key, node.computed))?;

        let Some(node_type) = &node.type_annotation else {
            self.report(node.span, e::input_field_untyped());
            return None;
        };

        let inner = self.collect_type(&node_type.type_annotation, FieldTypeContext::Input)?;

        let r#type = if node.optional {
            gql::nullable_type(inner).into()
        } else {
            inner
        };

        let ts = self.ts(node.node_id());
        let description = self.collect_description(ts);

        let directives = self.collect_directives(ts);

        Some(gql::input_value_definition(
            self.locatable(node.span),
            gql::name(self.locatable(id_span), id),
            r#type,
            Some(directives),
            None,
            description,
        ))
    }

    fn type_class_declaration(&mut self, node: TsNodeId, class: &'a Class<'a>, tag: TagId) {
        let Some(class_name) = &class.id else {
            return self.report(self.node_span(node), e::type_tag_on_unnamed_class());
        };

        let Some(name) =
            self.entity_name(self.node_span(node), Some(binding_name(class_name)), tag)
        else {
            return;
        };

        self.validate_operation_types(class_name.span, &name.value);

        let description = self.collect_description(node);
        let field_members: Vec<Member<'a>> = class
            .body
            .body
            .iter()
            // Static methods are handled when we encounter the tag at our top-level
            // traversal, similar to how functions are handled. We filter them out here to ensure
            // we don't double-visit them.
            .filter(|member| !is_static_method(member))
            .map(Member::Class)
            .collect();
        let fields = self.collect_fields(&field_members);
        let interfaces = self.collect_interfaces(node, Heritage::Class(class));
        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::Type);

        let members: Vec<Member<'a>> = class.body.body.iter().map(Member::Class).collect();
        let has_type_name = self.check_for_typename_property(&members, &name.value);

        let exported = if has_type_name {
            None
        } else {
            self.export_definition(node, &class_name.name)
        };

        let directives = self.collect_directives(node);

        let definition = gql::object_type_definition(
            self.locatable(self.node_span(node)),
            name,
            fields,
            interfaces,
            description,
            Some(directives),
            has_type_name,
            exported,
        );
        self.definitions
            .push(DefinitionNode::ObjectTypeDefinition(definition));
    }

    fn validate_operation_types(&mut self, node: Span, name: &str) {
        // TODO: If we start supporting defining operation types using
        // non-standard names, we will need to update this logic.
        if OPERATION_TYPES.contains(&name) {
            self.report(node, e::operation_type_not_unknown());
        }
    }

    fn type_interface_declaration(
        &mut self,
        node: TsNodeId,
        decl: &'a TSInterfaceDeclaration<'a>,
        tag: TagId,
    ) {
        let Some(name) = self.entity_name(self.node_span(node), Some(binding_name(&decl.id)), tag)
        else {
            return;
        };

        self.validate_operation_types(decl.id.span, &name.value);

        let description = self.collect_description(node);
        let members: Vec<Member<'a>> = decl.body.body.iter().map(Member::Type).collect();
        let fields = self.collect_fields(&members);
        let interfaces = self.collect_interfaces(node, Heritage::Interface(decl));
        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::Type);

        let has_type_name = self.check_for_typename_property(&members, &name.value);

        let directives = self.collect_directives(node);

        let definition = gql::object_type_definition(
            self.locatable(self.node_span(node)),
            name,
            fields,
            interfaces,
            description,
            Some(directives),
            has_type_name,
            None,
        );
        self.definitions
            .push(DefinitionNode::ObjectTypeDefinition(definition));
    }

    fn type_type_alias_declaration(
        &mut self,
        node: TsNodeId,
        decl: &'a TSTypeAliasDeclaration<'a>,
        tag: TagId,
    ) {
        let Some(name) = self.entity_name(self.node_span(node), Some(binding_name(&decl.id)), tag)
        else {
            return;
        };

        let (fields, interfaces, has_type_name) = match &decl.type_annotation {
            TSType::TSTypeLiteral(literal) => {
                self.validate_operation_types(literal.span, &name.value);
                let members: Vec<Member<'a>> = literal.members.iter().map(Member::Type).collect();
                let fields = self.collect_fields(&members);
                let interfaces = self.collect_interfaces(node, Heritage::TypeAlias);
                let has_type_name = self.check_for_typename_property(&members, &name.value);
                (fields, interfaces, has_type_name)
            }
            // This is fine, we just don't know what it is. This should be the expected
            // case for operation types such as `Query`, `Mutation`, and `Subscription`
            // where there is not strong convention around.
            TSType::TSUnknownKeyword(_) => (Vec::new(), None, false),
            other => {
                return self.report(
                    other.span(),
                    e::type_tag_on_alias_of_non_object_or_unknown(),
                );
            }
        };

        let description = self.collect_description(node);
        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::Type);

        let directives = self.collect_directives(node);

        let definition = gql::object_type_definition(
            self.locatable(self.node_span(node)),
            name,
            fields,
            interfaces,
            description,
            Some(directives),
            has_type_name,
            None,
        );
        self.definitions
            .push(DefinitionNode::ObjectTypeDefinition(definition));
    }

    fn check_for_typename_property(&mut self, members: &[Member<'a>], expected_name: &str) -> bool {
        let has_typename = members
            .iter()
            .any(|&member| self.is_valid_type_name_property(member, expected_name));
        if has_typename {
            self.types_with_typename.insert(expected_name.to_string());
        }
        has_typename
    }

    fn is_valid_type_name_property(&mut self, member: Member<'a>, expected_name: &str) -> bool {
        let Some(name) = self.member_name(member) else {
            return false;
        };
        let Name::Identifier(name_span, "__typename") = name else {
            return false;
        };

        match member {
            Member::Class(ClassElement::PropertyDefinition(property)) => self
                .is_valid_typename_property_declaration(
                    property.span,
                    name_span,
                    property.type_annotation.as_deref(),
                    property.value.as_ref(),
                    expected_name,
                ),
            Member::Class(ClassElement::AccessorProperty(property)) => self
                .is_valid_typename_property_declaration(
                    property.span,
                    name_span,
                    property.type_annotation.as_deref(),
                    property.value.as_ref(),
                    expected_name,
                ),
            Member::Type(TSSignature::TSPropertySignature(property)) => {
                self.is_valid_typename_property_signature(property, expected_name)
            }
            _ => {
                // TODO: Could show what kind we found, but TS AST does not have node names.
                self.report(name_span, e::type_name_not_declaration());
                false
            }
        }
    }

    /// Takes the parts of a property declaration which it reads, since oxc
    /// models `accessor` properties separately.
    fn is_valid_typename_property_declaration(
        &mut self,
        node: Span,
        node_name: Span,
        node_type: Option<&'a TSTypeAnnotation<'a>>,
        initializer: Option<&'a Expression<'a>>,
        expected_name: &str,
    ) -> bool {
        // If we have a type annotation, we ask that it be a string literal.
        // That means, that if we have one, _and_ it's valid, we're done.
        // Otherwise we fall through to the initializer check.
        if let Some(node_type) = node_type {
            return self.is_valid_typename_property_type(&node_type.type_annotation, expected_name);
        }
        let Some(initializer) = initializer else {
            self.report_with(
                node_name,
                e::type_name_missing_initializer(),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        };

        let Expression::TSAsExpression(initializer) = initializer else {
            self.report_with(
                initializer.span(),
                e::type_name_initialize_not_expression(expected_name),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        };

        let Expression::StringLiteral(expression) = &initializer.expression else {
            self.report_with(
                initializer.expression.span(),
                e::type_name_initialize_not_string(expected_name),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        };

        if expression.value != expected_name {
            self.report_with(
                expression.span,
                e::type_name_initializer_wrong(expected_name, &expression.value),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        }

        let TSType::TSTypeReference(initializer_type) = &initializer.type_annotation else {
            self.report_with(
                initializer.type_annotation.span(),
                e::type_name_type_not_reference_node(expected_name),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        };

        let TSTypeName::IdentifierReference(type_name) = &initializer_type.type_name else {
            self.report_with(
                initializer_type.type_name.span(),
                e::type_name_type_name_not_identifier(expected_name),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        };

        if type_name.name != "const" {
            self.report_with(
                type_name.span,
                e::type_name_type_name_not_const(expected_name),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        }

        true
    }

    fn fix_typename_property(&self, node: Span, expected_name: &str) -> CodeFixAction {
        CodeFixAction {
            fix_name: "fix-typename-property".to_string(),
            description: "Create Grats-compatible `__typename` property".to_string(),
            changes: vec![act::replace_node(
                self.locatable(node),
                &format!("__typename = \"{expected_name}\" as const;"),
            )],
        }
    }

    fn fix_typename_type(&self, node: Span, expected_name: &str) -> CodeFixAction {
        CodeFixAction {
            fix_name: "fix-typename-type".to_string(),
            description: "Create Grats-compatible `__typename` type".to_string(),
            changes: vec![act::replace_node(
                self.locatable(node),
                &format!("\"{expected_name}\""),
            )],
        }
    }

    fn is_valid_typename_property_signature(
        &mut self,
        node: &'a TSPropertySignature<'a>,
        expected_name: &str,
    ) -> bool {
        let Some(node_type) = &node.type_annotation else {
            self.report_with(
                node.span,
                e::type_name_missing_type_annotation(expected_name),
                Some(vec![]),
                Some(CodeFixAction {
                    fix_name: "add-typename-type".to_string(),
                    description: "Add Grats-compatible `__typename` type".to_string(),
                    changes: vec![act::suffix_node(
                        self.locatable(node.span),
                        &format!(": \"{expected_name}\""),
                    )],
                }),
            );
            return false;
        };
        self.is_valid_typename_property_type(&node_type.type_annotation, expected_name)
    }

    fn is_valid_typename_property_type(
        &mut self,
        node: &'a TSType<'a>,
        expected_name: &str,
    ) -> bool {
        let Some(literal) = string_literal_type(node) else {
            self.report_with(
                node.span(),
                e::type_name_type_not_string_literal(expected_name),
                Some(vec![]),
                Some(self.fix_typename_type(node.span(), expected_name)),
            );
            return false;
        };
        if literal.value != expected_name {
            self.report_with(
                node.span(),
                e::type_name_does_not_match_expected(expected_name),
                Some(vec![]),
                Some(self.fix_typename_type(node.span(), expected_name)),
            );
            return false;
        }
        true
    }

    fn collect_interfaces(
        &mut self,
        node: TsNodeId,
        heritage: Heritage<'a>,
    ) -> Option<Vec<NamedTypeNode>> {
        self.report_tag_interfaces(node, heritage);
        self.collect_heritage_interfaces(heritage)
    }

    fn report_tag_interfaces(&mut self, node: TsNodeId, heritage: Heritage<'a>) {
        let Some(tag) = self.find_tag(node, IMPLEMENTS_TAG_DEPRECATED) else {
            return;
        };

        let message = match heritage {
            Heritage::Class(_) => e::implements_tag_deprecated(),
            Heritage::Interface(_) => e::implements_tag_on_interface(),
            Heritage::TypeAlias => e::implements_tag_on_type_alias(),
        };
        self.report(self.tag_span(tag), message);
    }

    /// The interfaces in classes' `implements` clauses and interfaces'
    /// `extends` clauses.
    fn collect_heritage_interfaces(
        &mut self,
        heritage: Heritage<'a>,
    ) -> Option<Vec<NamedTypeNode>> {
        let types: Vec<(
            &'a TSTypeName<'a>,
            Option<&'a TSTypeParameterInstantiation<'a>>,
        )> = match heritage {
            Heritage::Class(class) => class
                .implements
                .iter()
                .map(|clause| (&clause.expression, clause.type_arguments.as_deref()))
                .collect(),
            Heritage::Interface(interface) => interface
                .extends
                .iter()
                .map(|clause| (&clause.type_name, clause.type_arguments.as_deref()))
                .collect(),
            Heritage::TypeAlias => return None,
        };

        let interfaces: Vec<NamedTypeNode> = types
            .into_iter()
            .filter_map(|(expression, type_arguments)| {
                let TSTypeName::IdentifierReference(expression) = expression else {
                    return None;
                };
                let named_type =
                    gql::named_type(self.locatable(expression.span), UNRESOLVED_REFERENCE_NAME);
                self.mark_unresolved_type(
                    EntityName::ExpressionWithTypeArguments {
                        expression,
                        type_arguments,
                    },
                    &named_type.name,
                );
                Some(named_type)
            })
            .collect();
        (!interfaces.is_empty()).then_some(interfaces)
    }

    fn interface_interface_declaration(
        &mut self,
        node: TsNodeId,
        decl: &'a TSInterfaceDeclaration<'a>,
        tag: TagId,
    ) {
        let Some(name) = self.entity_name(self.node_span(node), Some(binding_name(&decl.id)), tag)
        else {
            return;
        };

        self.interface_declarations
            .push(decl_ref(self.file, self.ast(node), self.node_span(node)));

        let description = self.collect_description(node);
        let interfaces = self.collect_interfaces(node, Heritage::Interface(decl));

        let members: Vec<Member<'a>> = decl.body.body.iter().map(Member::Type).collect();
        let fields = self.collect_fields(&members);

        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::Interface);

        let directives = self.collect_directives(node);

        let definition = gql::interface_type_definition(
            self.locatable(self.node_span(node)),
            name,
            fields,
            interfaces,
            description,
            Some(directives),
        );
        self.definitions
            .push(DefinitionNode::InterfaceTypeDefinition(definition));
    }

    fn collect_fields(&mut self, members: &[Member<'a>]) -> Vec<FieldDefinitionNode> {
        let mut fields: Vec<FieldDefinitionNode> = Vec::new();
        for &node in members {
            if let Member::Class(ClassElement::MethodDefinition(method)) = node
                && method.kind == MethodDefinitionKind::Constructor
            {
                // Handle parameter properties
                // https://www.typescriptlang.org/docs/handbook/2/classes.html#parameter-properties
                let params = params(method.value.this_param.as_deref(), &method.value.params);
                fields.extend(
                    params
                        .into_iter()
                        .filter_map(|param| self.constructor_param(param)),
                );
            }
            let field = if let Some(method) = method_like(node) {
                self.method_declaration(method)
            } else if let Some(property) = self.property_like(node) {
                self.property(property)
            } else {
                None
            };
            fields.extend(field);
        }
        fields
    }

    fn constructor_param(&mut self, node: Param<'a>) -> Option<FieldDefinitionNode> {
        let tag = self.find_tag(self.ts(node.node_id()), FIELD_TAG)?;
        let (accessibility, readonly, r#override) = match node {
            Param::Item(param) => (param.accessibility, param.readonly, param.r#override),
            Param::This(_) | Param::Rest(_) => (None, false, false),
        };
        if accessibility.is_none() && !readonly {
            let has_modifiers = !node.decorators().is_empty() || r#override;
            let fix_name = if has_modifiers {
                "add-public-modifier-to-existing"
            } else {
                "add-public-modifier"
            };
            // `public` must precede `override`, the only other modifier a
            // parameter can have here.
            let insert_before = if r#override {
                self.modifier_span(
                    node.modifiers_start(),
                    node.name().span().start,
                    Kind::Override,
                )
            } else {
                node.name().span()
            };
            self.report_with(
                node.span(),
                e::parameter_without_modifiers(),
                Some(vec![]),
                Some(CodeFixAction {
                    fix_name: fix_name.to_string(),
                    description: "Add 'public' modifier".to_string(),
                    changes: vec![act::prefix_node(self.locatable(insert_before), "public ")],
                }),
            );
            return None;
        }

        if let Some(not_public @ (TSAccessibility::Private | TSAccessibility::Protected)) =
            accessibility
        {
            let not_public = self.modifier_span(
                node.modifiers_start(),
                node.name().span().start,
                accessibility_kind(not_public),
            );
            self.report_with(
                not_public,
                e::parameter_property_not_public(),
                Some(vec![]),
                Some(CodeFixAction {
                    fix_name: "make-parameter-property-public".to_string(),
                    description: "Make parameter property public".to_string(),
                    changes: vec![act::replace_node(self.locatable(not_public), "public")],
                }),
            );
            return None;
        }

        let name = self.entity_name(node.span(), Some(node.name()), tag)?;

        let Some(node_type) = node.type_annotation() else {
            self.report(node.span(), e::parameter_property_missing_type());
            return None;
        };

        let Name::Identifier(_, id) = node.name() else {
            // TypeScript triggers an error if a binding pattern is used for a
            // parameter property, so we don't need to report them.
            // https://www.typescriptlang.org/play?#code/MYGwhgzhAEBiD29oG8BQ1rHgOwgFwCcBXYPeAgCgAciAjEAS2BQDNEBfAShXdXaA
            return None;
        };
        let ts = self.ts(node.node_id());
        let directives = self.collect_directives(ts);

        let r#type = self.collect_type(&node_type.type_annotation, FieldTypeContext::Output)?;

        let description = self.collect_description(ts);

        let kills_parent_on_exception = self.kills_parent_on_exception(ts);

        Some(gql::field_definition(
            self.locatable(node.span()),
            name,
            r#type,
            None,
            directives,
            description,
            kills_parent_on_exception,
            ResolverSignature::Property {
                name: Some(id.to_string()),
            },
        ))
    }

    fn collect_arg_defaults(&self, node: &'a ObjectPattern<'a>) -> ArgDefaults<'a> {
        node.properties
            .iter()
            .filter_map(|element| {
                if let BindingPattern::AssignmentPattern(initializer) = &element.value
                    && !element.computed
                    && let PropertyKey::StaticIdentifier(name) = &element.key
                {
                    Some((name.name.as_str(), &initializer.right))
                } else {
                    None
                }
            })
            .collect()
    }

    fn collect_arg(
        &mut self,
        node: &'a TSSignature<'a>,
        defaults: Option<&ArgDefaults<'a>>,
    ) -> Option<InputValueDefinitionNode> {
        let TSSignature::TSPropertySignature(node) = node else {
            // TODO: How can I create this error?
            self.report(node.span(), e::arg_is_not_property());
            return None;
        };
        let name = key_name(self.file, &node.key, node.computed);
        let Name::Identifier(name_span, name_text) = name else {
            // TODO: How can I create this error?
            self.report(name.span(), e::arg_name_not_literal());
            return None;
        };

        let Some(node_type) = &node.type_annotation else {
            self.report(name_span, e::arg_not_typed());
            return None;
        };
        let mut r#type = self.collect_type(&node_type.type_annotation, FieldTypeContext::Input)?;

        if !matches!(r#type, TypeNode::NonNullType(_)) && !node.optional {
            // If a field is passed an argument value, and that argument is not defined in the request,
            // `graphql-js` will not define the argument property. Therefore we must ensure the argument
            // is not just nullable, but optional.
            self.report_with(
                name_span,
                e::expected_nullable_argument_to_be_optional(),
                Some(vec![]),
                Some(CodeFixAction {
                    fix_name: "add-question-token-to-arg".to_string(),
                    description: "Make argument optional".to_string(),
                    changes: vec![act::suffix_node(self.locatable(name_span), "?")],
                }),
            );
            return None;
        }

        let default_value = defaults
            .and_then(|defaults| defaults.get(name_text))
            .and_then(|default| self.collect_const_value(default));

        if node.optional && default_value.is_none() {
            // Question mark means we can handle the argument being undefined in the
            // object literal, but if we are going to type the GraphQL arg as
            // optional, the code must also be able to handle an explicit null.
            //
            // ... unless there is a default value. In that case, the default will be
            // used argument is omitted or references an undefined variable.

            // TODO: This will catch { a?: string } but not { a?: string | undefined }.
            if matches!(r#type, TypeNode::NonNullType(_)) {
                self.report_with(
                    self.question_token(name_span.end),
                    e::non_null_type_cannot_be_optional(),
                    Some(vec![]),
                    Some(CodeFixAction {
                        fix_name: "add-null-to-optional-type".to_string(),
                        description: "Add '| null' to the type".to_string(),
                        changes: vec![act::suffix_node(
                            self.locatable(node_type.type_annotation.span()),
                            " | null",
                        )],
                    }),
                );
                return None;
            }
            r#type = gql::nullable_type(r#type).into();
        }

        let ts = self.ts(node.node_id());
        let description = self.collect_description(ts);

        let directives = self.collect_directives(ts);

        Some(gql::input_value_definition(
            self.locatable(node.span),
            gql::name(self.locatable(name_span), name_text),
            r#type,
            Some(directives),
            default_value,
            description,
        ))
    }

    fn collect_const_value(&mut self, node: &'a Expression<'a>) -> Option<ConstValueNode> {
        let value = match node {
            Expression::StringLiteral(literal) => ConstValueNode::StringValue(gql::string(
                self.locatable(literal.span),
                &literal.value,
                false,
            )),
            Expression::TemplateLiteral(literal) if literal.expressions.is_empty() => {
                let quasi = &literal.quasis[0].value;
                let text = quasi.cooked.as_ref().unwrap_or(&quasi.raw);
                ConstValueNode::StringValue(gql::string(self.locatable(literal.span), text, false))
            }
            Expression::NumericLiteral(literal) => {
                // Like TypeScript, read the number as JavaScript would print
                // it, so `1.0` is an Int.
                let text = literal.value.to_js_string();
                if text.contains('.') {
                    ConstValueNode::FloatValue(gql::float(self.locatable(literal.span), &text))
                } else {
                    ConstValueNode::IntValue(gql::int(self.locatable(literal.span), &text))
                }
            }
            Expression::Identifier(id) if id.name == "undefined" => {
                ConstValueNode::NullValue(gql::null(self.locatable(id.span)))
            }
            Expression::NullLiteral(literal) => {
                ConstValueNode::NullValue(gql::null(self.locatable(literal.span)))
            }
            Expression::BooleanLiteral(literal) => ConstValueNode::BooleanValue(gql::boolean(
                self.locatable(literal.span),
                literal.value,
            )),
            Expression::ObjectExpression(object) => {
                return self
                    .collect_object_literal(object)
                    .map(ConstValueNode::ObjectValue);
            }
            Expression::ArrayExpression(array) => {
                return self
                    .collect_array_literal(array)
                    .map(ConstValueNode::ListValue);
            }
            // Note: The text of the property access name may not actually be the
            // value of the enum. For example, the enum may have a value of `1` but
            // the property access name may be `ONE`.
            //
            // A later transform (after we become type aware) takes care of fixing
            // this up.
            Expression::StaticMemberExpression(member) => {
                self.enum_value(member.span, &member.property.name)
            }
            Expression::PrivateFieldExpression(member) => {
                self.enum_value(member.span, &format!("#{}", member.field.name))
            }
            // Like TypeScript, treat optional chains as property accesses.
            Expression::ChainExpression(chain) => match &chain.expression {
                ChainElement::StaticMemberExpression(member) => {
                    self.enum_value(chain.span, &member.property.name)
                }
                ChainElement::PrivateFieldExpression(member) => {
                    self.enum_value(chain.span, &format!("#{}", member.field.name))
                }
                _ => return self.report_not_literal(node.span()),
            },
            _ => return self.report_not_literal(node.span()),
        };
        Some(value)
    }

    fn enum_value(&self, span: Span, value: &str) -> ConstValueNode {
        ConstValueNode::EnumValue(gql::r#enum(self.locatable(span), value))
    }

    fn report_not_literal<T>(&mut self, span: Span) -> Option<T> {
        self.report_unhandled(
            span,
            "constant value",
            e::default_value_is_not_literal(),
            None,
        );
        None
    }

    fn collect_array_literal(
        &mut self,
        node: &'a ArrayExpression<'a>,
    ) -> Option<ConstListValueNode> {
        // Collect every element before giving up, so all their errors are
        // reported.
        let values: Vec<Option<ConstValueNode>> = node
            .elements
            .iter()
            .map(|element| match element.as_expression() {
                Some(element) => self.collect_const_value(element),
                None => self.report_not_literal(self.array_element_span(element)),
            })
            .collect();
        let values = values.into_iter().collect::<Option<_>>()?;
        Some(gql::list(self.locatable(node.span), values))
    }

    fn collect_object_literal(
        &mut self,
        node: &'a ObjectExpression<'a>,
    ) -> Option<ConstObjectValueNode> {
        // Collect every field before giving up, so all their errors are
        // reported.
        let fields: Vec<Option<ConstObjectFieldNode>> = node
            .properties
            .iter()
            .map(|property| self.collect_object_field(property))
            .collect();
        let fields = fields.into_iter().collect::<Option<_>>()?;
        Some(gql::object(self.locatable(node.span), fields))
    }

    fn collect_object_field(
        &mut self,
        node: &'a ObjectPropertyKind<'a>,
    ) -> Option<ConstObjectFieldNode> {
        let Some(property) = init_property(node) else {
            self.report_unhandled(
                node.span(),
                "constant value",
                e::default_arg_element_is_not_assignment(),
                None,
            );
            return None;
        };
        let (name_span, name) =
            self.expect_name_identifier(key_name(self.file, &property.key, property.computed))?;

        let value = self.collect_const_value(&property.value)?;
        Some(gql::const_object_field(
            self.locatable(property.span),
            gql::name(self.locatable(name_span), name),
            value,
        ))
    }

    fn enum_enum_declaration(
        &mut self,
        node: TsNodeId,
        decl: &'a TSEnumDeclaration<'a>,
        tag: TagId,
    ) {
        let Some(name) = self.entity_name(self.node_span(node), Some(binding_name(&decl.id)), tag)
        else {
            return;
        };
        let exported = self.export_definition(node, &decl.id.name);
        // Check if enum must be exported when tsClientEnums is configured
        if self.config.ts_client_enums.is_some() && exported.is_none() {
            self.report_with(
                self.node_span(node),
                e::enum_not_exported(),
                Some(vec![]),
                Some(CodeFixAction {
                    fix_name: "add-export-keyword-to-enum".to_string(),
                    description: "Add export keyword to enum with @gqlEnum".to_string(),
                    changes: vec![act::prefix_node(
                        self.locatable(self.node_span(node)),
                        "export ",
                    )],
                }),
            );
            return;
        }

        let description = self.collect_description(node);
        let values = self.collect_enum_values(decl);
        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::Enum);

        let directives = self.collect_directives(node);

        let definition = gql::enum_type_definition(
            self.locatable(self.node_span(node)),
            name,
            values,
            description,
            Some(directives),
            exported,
        );
        self.definitions
            .push(DefinitionNode::EnumTypeDefinition(definition));
    }

    /// Where `node`, which is named `name`, is exported from, if it's
    /// exported.
    fn export_definition(&self, node: TsNodeId, name: &str) -> Option<ExportDefinition> {
        self.export_kind(node).map(|is_default| ExportDefinition {
            ts_module_path: path::relative(self.grats_root, &self.file.path),
            export_name: (!is_default).then(|| name.to_string()),
        })
    }

    fn enum_type_alias_declaration(
        &mut self,
        node: TsNodeId,
        decl: &'a TSTypeAliasDeclaration<'a>,
        tag: TagId,
    ) {
        let Some(name) = self.entity_name(self.node_span(node), Some(binding_name(&decl.id)), tag)
        else {
            return;
        };

        // Prohibit type alias enums when tsClientEnums is configured
        if self.config.ts_client_enums.is_some() {
            return self.report(
                self.node_span(node),
                e::type_alias_enum_not_supported_with_emit_enums(),
            );
        }

        let Some(values) = self.enum_type_alias_variants(node, decl) else {
            return;
        };

        let description = self.collect_description(node);
        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::Enum);

        let directives = self.collect_directives(node);

        let definition = gql::enum_type_definition(
            self.locatable(self.node_span(node)),
            name,
            values,
            description,
            Some(directives),
            None,
        );
        self.definitions
            .push(DefinitionNode::EnumTypeDefinition(definition));
    }

    fn enum_type_alias_variants(
        &mut self,
        node: TsNodeId,
        decl: &'a TSTypeAliasDeclaration<'a>,
    ) -> Option<Vec<EnumValueDefinitionNode>> {
        // Semantically we only support deriving enums from type aliases that
        // are unions of string literals. However, in the edge case of a union
        // of one item, there is no way to construct a union type of one item in
        // TypeScript. So, we also support deriving enums from type aliases of a single
        // string literal.
        if let Some(literal) = string_literal_type(&decl.type_annotation) {
            return Some(vec![gql::enum_value_definition(
                self.locatable(self.node_span(node)),
                gql::name(self.locatable(literal.span), &literal.value),
                None,
                None,
                None,
            )]);
        }

        if let TSType::TSIndexedAccessType(indexed_access) = &decl.type_annotation {
            return self.enum_type_alias_from_preceding_const(node, decl, indexed_access);
        }

        let TSType::TSUnionType(union) = &decl.type_annotation else {
            self.report_unhandled(
                decl.type_annotation.span(),
                "union",
                e::enum_tag_on_invalid_node(),
                None,
            );
            return None;
        };

        let values = union
            .types
            .iter()
            .filter_map(|member| {
                let Some(literal) = string_literal_type(member) else {
                    self.report_unhandled(
                        member.span(),
                        "union member",
                        e::enum_variant_not_string_literal(),
                        None,
                    );
                    return None;
                };
                let ts = self.ts(member_type_node_id(member));
                let description = self.collect_description(ts);
                let directives = self.collect_directives(ts);
                Some(gql::enum_value_definition(
                    self.locatable(self.node_span(node)),
                    gql::name(self.locatable(literal.span), &literal.value),
                    Some(directives),
                    description,
                    None,
                ))
            })
            .collect();

        Some(values)
    }

    /// Handle `@gqlEnum` type aliases that derive their values from a preceding
    /// const declaration. Supports two patterns:
    ///
    /// - Const array: `(typeof VALUES)[number]`
    /// - Const object: `(typeof OBJ)[keyof typeof OBJ]`
    ///
    /// The const declaration must be the immediately preceding statement to ensure
    /// it's clear which declarations contribute to the GraphQL schema.
    fn enum_type_alias_from_preceding_const(
        &mut self,
        node: TsNodeId,
        decl: &'a TSTypeAliasDeclaration<'a>,
        indexed_access: &'a TSIndexedAccessType<'a>,
    ) -> Option<Vec<EnumValueDefinitionNode>> {
        // Unwrap parenthesized types: `(typeof X)[number]` vs `typeof X[number]`
        let mut object_type: &TSType = &indexed_access.object_type;
        while let TSType::TSParenthesizedType(parenthesized) = object_type {
            object_type = &parenthesized.type_annotation;
        }

        // The object type must be `typeof X` where X is an identifier
        let Some(referenced_name) = type_query_identifier(object_type) else {
            self.report_unhandled(
                indexed_access.span,
                "union",
                e::enum_tag_on_invalid_node(),
                None,
            );
            return None;
        };

        // Determine the pattern from the index type
        let is_array_pattern = match &indexed_access.index_type {
            // (typeof X)[number] — const array
            TSType::TSNumberKeyword(_) => true,
            // (typeof X)[keyof typeof X] — const object
            TSType::TSTypeOperatorType(operator)
                if operator.operator == TSTypeOperatorOperator::Keyof
                    && type_query_identifier(&operator.type_annotation)
                        == Some(referenced_name) =>
            {
                false
            }
            _ => {
                self.report_unhandled(
                    indexed_access.span,
                    "union",
                    e::enum_tag_on_invalid_node(),
                    None,
                );
                return None;
            }
        };

        // Find the preceding statement in the containing block (source file,
        // namespace body, etc.)
        let nodes = self.file.semantic().nodes();
        // oxc wraps an exported declaration in its export declaration.
        let statement = match nodes.parent_kind(decl.node_id()) {
            AstKind::ExportDeclaration(export) => export.node_id(),
            _ => decl.node_id(),
        };
        let statement_span = nodes.kind(statement).span();
        let statements: Option<&'a [Statement<'a>]> = match nodes.parent_kind(statement) {
            AstKind::Program(program) => Some(&program.body),
            AstKind::BlockStatement(block) => Some(&block.body),
            AstKind::FunctionBody(body) => Some(&body.statements),
            AstKind::TSModuleBlock(block) => Some(&block.body),
            AstKind::SwitchCase(case) => Some(&case.consequent),
            AstKind::StaticBlock(block) => Some(&block.body),
            _ => None,
        };
        let preceding_statement = statements.and_then(|statements| {
            let index = statements
                .iter()
                .position(|statement| statement.span() == statement_span)?;
            statements.get(index.checked_sub(1)?)
        });

        // Preceding statement must declare a single const
        let Some((declaration, declaration_name)) =
            preceding_statement.and_then(sole_const_declarator)
        else {
            self.report(indexed_access.span, e::enum_const_must_precede_type_alias());
            return None;
        };

        // Validate the name matches
        if declaration_name.name != referenced_name {
            self.report(
                indexed_access.span,
                e::enum_const_name_mismatch(referenced_name, &declaration_name.name),
            );
            return None;
        }

        // Extract the `as const` expression, handling both `X as const` and `X as const satisfies T`
        let Some(const_expr) = extract_as_const_expression(declaration) else {
            self.report(indexed_access.span, e::enum_const_missing_as_const());
            return None;
        };

        if is_array_pattern {
            self.enum_values_from_array_literal(node, const_expr)
        } else {
            self.enum_values_from_object_literal(const_expr)
        }
    }

    fn enum_values_from_array_literal(
        &mut self,
        node: TsNodeId,
        expr: &'a Expression<'a>,
    ) -> Option<Vec<EnumValueDefinitionNode>> {
        let Expression::ArrayExpression(expr) = expr else {
            self.report(expr.span(), e::enum_const_invalid_expression());
            return None;
        };

        let values = expr
            .elements
            .iter()
            .filter_map(|element| {
                let Some(Expression::StringLiteral(element)) = element.as_expression() else {
                    self.report_unhandled(
                        self.array_element_span(element),
                        "union member",
                        e::enum_variant_not_string_literal(),
                        None,
                    );
                    return None;
                };

                self.validate_enum_value_name(element);

                let ts = self.ts(element.node_id());
                let description = self.collect_description(ts);
                let directives = self.collect_directives(ts);
                Some(gql::enum_value_definition(
                    self.locatable(self.node_span(node)),
                    gql::name(self.locatable(element.span), &element.value),
                    Some(directives),
                    description,
                    None,
                ))
            })
            .collect();

        Some(values)
    }

    fn enum_values_from_object_literal(
        &mut self,
        expr: &'a Expression<'a>,
    ) -> Option<Vec<EnumValueDefinitionNode>> {
        let Expression::ObjectExpression(expr) = expr else {
            self.report(expr.span(), e::enum_const_invalid_expression());
            return None;
        };

        let values = expr
            .properties
            .iter()
            .filter_map(|prop| {
                let assignment = init_property(prop).and_then(|property| match &property.value {
                    Expression::StringLiteral(value) => Some((property, value)),
                    _ => None,
                });
                let Some((prop, value)) = assignment else {
                    self.report_unhandled(
                        prop.span(),
                        "enum value",
                        e::enum_variant_not_string_literal(),
                        None,
                    );
                    return None;
                };

                self.validate_enum_value_name(value);

                let ts = self.ts(prop.node_id());
                let description = self.collect_description(ts);
                let directives = self.collect_directives(ts);

                let prop_name = key_name(self.file, &prop.key, prop.computed).span();
                Some(gql::enum_value_definition(
                    self.locatable(prop.span),
                    gql::name(self.locatable(value.span), &value.value),
                    Some(directives),
                    description,
                    Some(self.text(prop_name).to_string()),
                ))
            })
            .collect();

        Some(values)
    }

    fn collect_enum_values(
        &mut self,
        node: &'a TSEnumDeclaration<'a>,
    ) -> Vec<EnumValueDefinitionNode> {
        node.body
            .members
            .iter()
            .filter_map(|member| {
                let Some(Expression::StringLiteral(initializer)) = &member.initializer else {
                    self.report_unhandled(
                        member.span,
                        "enum value",
                        e::enum_variant_missing_initializer(),
                        None,
                    );
                    return None;
                };

                self.validate_enum_value_name(initializer);

                let ts = self.ts(member.node_id());
                let description = self.collect_description(ts);
                let directives = self.collect_directives(ts);

                let member_name = match &member.id {
                    TSEnumMemberName::Identifier(name) => name.span,
                    TSEnumMemberName::String(name) => name.span,
                    TSEnumMemberName::ComputedString(name) => bracket_span(self.file, name.span),
                    TSEnumMemberName::ComputedTemplateString(name) => {
                        bracket_span(self.file, name.span)
                    }
                };
                Some(gql::enum_value_definition(
                    self.locatable(member.span),
                    gql::name(self.locatable(initializer.span), &initializer.value),
                    Some(directives),
                    description,
                    Some(self.text(member_name).to_string()),
                ))
            })
            .collect()
    }

    /// Reports an enum value which isn't a valid GraphQL name.
    fn validate_enum_value_name(&mut self, value: &StringLiteral) {
        if let Some(message) = graphql_name_validation_message(&value.value) {
            self.report(value.span, message);
        }
    }

    /// `node` is the span of the declaration, and `name` its name, if it has
    /// one.
    fn entity_name(&mut self, node: Span, name: Option<Name<'a>>, tag: TagId) -> Option<NameNode> {
        let jsdoc = self.jsdoc;
        let tag_data = jsdoc.tag(tag);
        if let Some(loc_node) = tag_data.comment_span
            && let Some(comment_name) = get_text_of_js_doc_comment(tag_data.comment.as_ref())
                .map(|text| normalize_newlines(&text).into_owned())
        {
            let has_leading_newlines = self
                .text(Span::new(tag_data.tag_name.end, loc_node.start))
                .contains(is_line_break);
            let has_internal_whitespace = comment_name.chars().any(is_js_white_space);
            let validation_message = graphql_name_validation_message(&comment_name);

            if has_leading_newlines && validation_message.is_none() {
                // TODO: Offer quick fix.
                self.report(
                    loc_node,
                    e::graphql_name_has_leading_newlines(&comment_name, &tag_data.tag_name.text),
                );
                return None;
            }

            if has_leading_newlines || has_internal_whitespace {
                self.report(
                    loc_node,
                    e::graphql_tag_name_has_whitespace(&tag_data.tag_name.text),
                );
                return None;
            }

            // No whitespace, but still invalid. We will assume they meant this to
            // be a GraphQL name but didn't provide a valid identifier.
            //
            // NOTE: We can't let GraphQL validation handle this, because it throws rather
            // than returning a validation message. Presumably because it expects token
            // validation to be done during lexing/parsing.
            if let Some(validation_message) = validation_message {
                self.report(loc_node, validation_message);
                return None;
            }
            return Some(gql::name(self.locatable(loc_node), &comment_name));
        }

        let Some(name) = name else {
            self.report(node, e::gql_entity_missing_name());
            return None;
        };
        let (id_span, id) = self.expect_name_identifier(name)?;
        Some(gql::name(self.locatable(id_span), id))
    }

    fn method_declaration(&mut self, node: MethodLike<'a>) -> Option<FieldDefinitionNode> {
        let tag = self.find_tag(self.ts(node.id), FIELD_TAG)?;

        let name_node = key_name(self.file, node.key, node.computed);
        let name_start = name_node.span().start;
        if let Some(not_public @ (TSAccessibility::Private | TSAccessibility::Protected)) =
            node.accessibility
        {
            self.report(
                self.modifier_span(
                    node.modifiers_start,
                    name_start,
                    accessibility_kind(not_public),
                ),
                e::invalid_field_non_public_access_modifier(),
            );
        }
        if node.r#static {
            // Return early here, since static methods expect a parent object as
            // first argument rather than args, and we don't want to emit
            // confusing error messages
            // Note: We expect that static methods are handled at the top-level
            // and will be filtered out before getting here.
            let r#static = self.modifier_span(node.modifiers_start, name_start, Kind::Static);
            self.report(r#static, e::invalid_static_modifier());
            return None;
        }

        let name = self.entity_name(node.span, Some(name_node), tag)?;

        let Some(node_type) = node.return_type else {
            self.report(name_node.span(), e::method_missing_type());
            return None;
        };

        let r#type = self.collect_type(&node_type.type_annotation, FieldTypeContext::Output)?;

        let (resolver_params, args) = self.resolver_params(&node.params)?;

        let ts = self.ts(node.id);
        let description = self.collect_description(ts);

        let (_, id) = self.expect_name_identifier(name_node)?;
        let directives = self.collect_directives(ts);

        let kills_parent_on_exception = self.kills_parent_on_exception(ts);

        let resolver_name = (id != name.value).then(|| id.to_string());
        Some(gql::field_definition(
            self.locatable(node.span),
            name,
            r#type,
            args,
            directives,
            description,
            kills_parent_on_exception,
            if node.callable {
                ResolverSignature::Method {
                    name: resolver_name,
                    arguments: Some(resolver_params),
                }
            } else {
                ResolverSignature::Property {
                    name: resolver_name,
                }
            },
        ))
    }

    // A resolver may have some number of positional args `resolverParams`. It may
    // also have at most one object literal argument (`args`), which is treated as
    // a map of named arguments.
    #[allow(clippy::type_complexity)]
    fn resolver_params(
        &mut self,
        parameters: &[Param<'a>],
    ) -> Option<(Vec<ResolverArgument>, Option<Vec<InputValueDefinitionNode>>)> {
        let mut resolver_params: Vec<ResolverArgument> = Vec::new();

        let mut args: Option<(Param<'a>, Vec<InputValueDefinitionNode>)> = None;

        for &param in parameters {
            if let Param::Rest(rest) = param {
                self.report(
                    Span::new(rest.rest.span.start, rest.rest.span.start + 3),
                    e::unexpected_param_spread_for_resolver_param(),
                );
                return None;
            }
            let Some(param_type) = param.type_annotation() else {
                self.report(param.span(), e::resolver_param_is_missing_type());
                return None;
            };
            if let TSType::TSTypeLiteral(literal) = &param_type.type_annotation {
                if let Some((previous, _)) = &args {
                    let related = ts_related(
                        self.locatable(previous.span()),
                        "Previous type literal".to_string(),
                    );
                    self.report_with(
                        param.span(),
                        e::multiple_resolver_type_literals(),
                        Some(vec![related]),
                        None,
                    );
                    return None;
                }
                resolver_params.push(ResolverArgument::ArgumentsObject {
                    loc: Some(self.locatable(param.span()).loc()),
                });
                let defaults = if let Param::Item(item) = param
                    && let BindingPattern::ObjectPattern(pattern) = &item.pattern
                {
                    Some(self.collect_arg_defaults(pattern))
                } else {
                    None
                };

                let inputs = literal
                    .members
                    .iter()
                    .filter_map(|member| self.collect_arg(member, defaults.as_ref()))
                    .collect();
                args = Some((param, inputs));
                continue;
            }

            let input_definition = self.collect_param_arg(param, param_type)?;
            resolver_params.push(ResolverArgument::Unresolved {
                input_definition,
                loc: Some(self.locatable(param.span()).loc()),
            });
        }
        Some((resolver_params, args.map(|(_, inputs)| inputs)))
    }

    /// Takes the parameter's type annotation, which the caller has checked is
    /// present.
    fn collect_param_arg(
        &mut self,
        param: Param<'a>,
        param_type: &'a TSTypeAnnotation<'a>,
    ) -> Option<InputValueDefinitionNodeOrResolverArg> {
        // This param might be info or context, in which case we don't need a name,
        // or it might be a GraphQL argument, in which case we _do_ need a name.
        // However, we don't know which we have until a later phase where were are
        // type-aware.
        // By modeling the name as a diagnostic result, we can defer the decision
        // of whether the name is required until we have more information.
        let param_name = param.name();
        let mut name: DiagnosticHandleResult<NameNode> = match param_name {
            Name::Identifier(span, text) => DiagnosticHandleResult::Ok {
                value: gql::name(self.locatable(span), text),
            },
            Name::Other(span) => self.diagnostic_handle(ts_err(
                self.locatable(span),
                e::positional_resolver_arg_does_not_have_name(),
                None,
                None,
            )),
        };

        let r#type = self.collect_type(&param_type.type_annotation, FieldTypeContext::Input)?;

        let default_value = param
            .initializer()
            .and_then(|initializer| self.collect_const_value(initializer));

        // Question mark means we can handle the argument being undefined in the
        // object literal, but if we are going to type the GraphQL arg as
        // optional, the code must also be able to handle an explicit null.
        //
        // In the object map args case we have to consider the possibility of a
        // default value, but TS does not allow default value for optional args,
        // so TS will take care of that for us.
        //
        // This is only a problem if the type turns out to be a GraphQL type.
        // If it's info or context, it's fine. So, we defer the error until
        // later when we try to use this as a GraphQL type.
        if param.optional()
            && matches!(r#type, TypeNode::NonNullType(_))
            && matches!(name, DiagnosticHandleResult::Ok { .. })
        {
            let diagnostic = ts_err(
                self.locatable(self.question_token(param_name.span().end)),
                e::non_null_type_cannot_be_optional(),
                Some(vec![]),
                Some(CodeFixAction {
                    fix_name: "add-null-to-optional-parameter-type".to_string(),
                    description: "Add '| null' to the parameter type".to_string(),
                    changes: vec![act::suffix_node(
                        self.locatable(param_type.type_annotation.span()),
                        " | null",
                    )],
                }),
            );
            name = self.diagnostic_handle(diagnostic);
        }

        let ts = self.ts(param.node_id());
        let directives = self.collect_directives(ts);

        let description = self.collect_description(ts);
        Some(gql::input_value_definition_or_resolver_arg(
            self.locatable(param.span()),
            name,
            r#type,
            Some(directives),
            default_value,
            description,
        ))
    }

    /// Records `diagnostic`, returning a handle which refers to it.
    fn diagnostic_handle<T>(&mut self, diagnostic: Diagnostic) -> DiagnosticHandleResult<T> {
        let handle = DiagnosticHandle { id: unique_id() };
        self.diagnostics_by_handle.insert(handle, diagnostic);
        DiagnosticHandleResult::Error { err: handle }
    }

    fn collect_description(&mut self, node: TsNodeId) -> Option<StringValueNode> {
        let jsdoc = self.jsdoc;
        let comment: String = jsdoc
            .get_js_doc_comments_and_tags(node)
            .into_iter()
            .filter_map(|doc| match doc {
                JSDocOrTag::JSDoc(doc) => Some(doc),
                JSDocOrTag::Tag(_) => None,
            })
            .map(|doc| {
                jsdoc
                    .js_doc(doc)
                    .comment
                    .as_ref()
                    .map_or_else(String::new, |comment| template_string(Some(comment)))
            })
            .collect();

        let comment = normalize_newlines(&comment);
        (!comment.is_empty()).then(|| {
            gql::string(
                self.locatable(self.node_span(node)),
                js_trim(&comment),
                true,
            )
        })
    }

    fn property(&mut self, node: PropertyLike<'a>) -> Option<FieldDefinitionNode> {
        let tag = self.find_tag(self.ts(node.id), FIELD_TAG)?;

        let node_name = key_name(self.file, node.key, node.computed);
        let name = self.entity_name(node.span, Some(node_name), tag)?;

        let Some(node_type) = node.type_annotation else {
            self.report(node_name.span(), e::property_field_missing_type());
            return None;
        };

        let inner = self.collect_type(&node_type.type_annotation, FieldTypeContext::Output)?;
        let r#type = if node.optional {
            gql::nullable_type(inner).into()
        } else {
            inner
        };

        let ts = self.ts(node.id);
        let description = self.collect_description(ts);

        let (_, id) = self.expect_name_identifier(node_name)?;

        let directives = self.collect_directives(ts);

        let kills_parent_on_exception = self.kills_parent_on_exception(ts);

        let resolver_name = (id != name.value).then(|| id.to_string());
        Some(gql::field_definition(
            self.locatable(node.span),
            name,
            r#type,
            None,
            directives,
            description,
            kills_parent_on_exception,
            ResolverSignature::Property {
                name: resolver_name,
            },
        ))
    }

    // TODO: Support separate modes for input and output types
    // For input nodes and field may only be optional if `null` is a valid value.
    fn collect_type(&mut self, node: &'a TSType<'a>, ctx: FieldTypeContext) -> Option<TypeNode> {
        match node {
            TSType::TSTypeReference(reference) => self.type_reference(node, reference, ctx),
            TSType::TSArrayType(array) => {
                let element = self.collect_type(&array.element_type, ctx)?;
                Some(gql::non_null_type(
                    self.locatable(array.span),
                    TypeNode::ListType(gql::list_type(self.locatable(array.span), element)),
                ))
            }
            TSType::TSUnionType(union) => self.collect_union_type(union, ctx),
            TSType::TSParenthesizedType(parenthesized) => {
                self.collect_type(&parenthesized.type_annotation, ctx)
            }
            TSType::TSStringKeyword(keyword) => {
                Some(self.non_null_named_type(keyword.span, "String"))
            }
            TSType::TSBooleanKeyword(keyword) => {
                Some(self.non_null_named_type(keyword.span, "Boolean"))
            }
            TSType::TSNumberKeyword(keyword) => {
                self.report(keyword.span, e::ambiguous_number_type());
                None
            }
            // Literal types are only valid in output positions. In input positions,
            // GraphQL cannot enforce that only this specific value is passed.
            _ if ctx == FieldTypeContext::Input && is_literal_type(node) => {
                self.report(node.span(), e::literal_type_in_input_position());
                None
            }
            TSType::TSLiteralType(literal) => match &literal.literal {
                TSLiteral::BooleanLiteral(_) => {
                    Some(self.non_null_named_type(literal.span, "Boolean"))
                }
                TSLiteral::StringLiteral(_) => {
                    Some(self.non_null_named_type(literal.span, "String"))
                }
                TSLiteral::NumericLiteral(_) => {
                    self.report(literal.span, e::ambiguous_number_literal_type());
                    None
                }
                _ => self.report_unknown_type(node.span()),
            },
            TSType::TSTypeLiteral(literal) => {
                self.report(literal.span, e::unsupported_type_literal());
                None
            }
            TSType::TSTypeOperatorType(operator)
                if operator.operator == TSTypeOperatorOperator::Readonly =>
            {
                self.collect_type(&operator.type_annotation, ctx)
            }
            _ => self.report_unknown_type(node.span()),
        }
    }

    fn collect_union_type(
        &mut self,
        union: &'a TSUnionType<'a>,
        ctx: FieldTypeContext,
    ) -> Option<TypeNode> {
        let types: Vec<&'a TSType<'a>> = union
            .types
            .iter()
            .filter(|r#type| !is_nullish(r#type))
            .collect();
        let [first, rest @ ..] = types.as_slice() else {
            self.report(union.span, e::expected_one_non_nullish_type());
            return None;
        };

        let r#type = self.collect_type(first, ctx)?;

        if !rest.is_empty() {
            // FIXME: If each of `rest` matches `first` this should be okay.
            let incompatible_variants = rest
                .iter()
                .map(|ts_type| {
                    ts_related(
                        self.locatable(ts_type.span()),
                        "Other non-nullish type".to_string(),
                    )
                })
                .collect();
            self.report_with(
                first.span(),
                e::expected_one_non_nullish_type(),
                Some(incompatible_variants),
                None,
            );
            return None;
        }
        if union.types.len() > 1 {
            Some(gql::with_location(
                self.locatable(union.span),
                gql::nullable_type(r#type),
            ))
        } else {
            Some(gql::non_null_type(self.locatable(union.span), r#type))
        }
    }

    fn non_null_named_type(&self, span: Span, name: &str) -> TypeNode {
        gql::non_null_type(
            self.locatable(span),
            TypeNode::NamedType(gql::named_type(self.locatable(span), name)),
        )
    }

    fn report_unknown_type<T>(&mut self, span: Span) -> Option<T> {
        // TODO: Better error message. This is okay if it's a type reference, but everything else is not.
        self.report_unhandled(span, "type", e::unknown_graphql_type(), None);
        None
    }

    /// Unwraps a Promise<T> type to T, tracking whether it was async.
    /// Returns `None` if there's an error (e.g., Promise without type arguments).
    fn maybe_unwrap_promise_type(&mut self, r#type: &'a TSType<'a>) -> Option<UnwrappedType<'a>> {
        if let TSType::TSTypeReference(reference) = r#type
            && let TSTypeName::IdentifierReference(type_name) = &reference.type_name
            && type_name.name == "Promise"
        {
            let type_argument = match reference.type_arguments.as_deref() {
                Some(type_arguments) => match type_arguments.params.as_slice() {
                    [type_argument] => Some(type_argument),
                    _ => None,
                },
                None => None,
            };
            let Some(type_argument) = type_argument else {
                self.report(reference.span, e::wrapper_missing_type_arg(&type_name.name));
                return None;
            };
            return Some(UnwrappedType {
                r#type: type_argument,
                is_async: true,
            });
        }

        Some(UnwrappedType {
            r#type,
            is_async: false,
        })
    }

    /// Takes the type reference both as a type and as a reference.
    fn type_reference(
        &mut self,
        type_node: &'a TSType<'a>,
        node: &'a TSTypeReference<'a>,
        ctx: FieldTypeContext,
    ) -> Option<TypeNode> {
        let (_, type_name) = self.expect_name_identifier(type_name(&node.type_name))?;

        // Some types are not valid as input types. Validate that here:
        if ctx == FieldTypeContext::Input && matches!(type_name, "AsyncIterable" | "Promise") {
            self.report(
                node.span,
                format!("`{type_name}` is not valid as an input type."),
            );
            return None;
        }
        match type_name {
            "Array" | "Iterator" | "ReadonlyArray" | "AsyncIterable" => {
                let Some(type_arguments) = &node.type_arguments else {
                    self.report(node.span, e::plural_type_missing_parameter());
                    return None;
                };
                let element = self.collect_type(type_arguments.params.first()?, ctx)?;
                let mut list_type = gql::list_type(self.locatable(node.span), element);
                list_type.is_async_iterable = type_name == "AsyncIterable";
                Some(gql::non_null_type(
                    self.locatable(node.span),
                    TypeNode::ListType(list_type),
                ))
            }
            "Promise" => {
                let unwrapped = self.maybe_unwrap_promise_type(type_node)?;
                self.collect_type(unwrapped.r#type, ctx)
            }
            _ => {
                // We may not have encountered the definition of this type yet. So, we
                // mark it as unresolved and return a placeholder type.
                //
                // A later pass will resolve the type.
                let named_type =
                    gql::named_type(self.locatable(node.span), UNRESOLVED_REFERENCE_NAME);
                self.mark_unresolved_type(EntityName::TypeReference(node), &named_type.name);
                Some(gql::non_null_type(
                    self.locatable(node.span),
                    TypeNode::NamedType(named_type),
                ))
            }
        }
    }

    fn expect_name_identifier(&mut self, node: Name<'a>) -> Option<(Span, &'a str)> {
        match node {
            Name::Identifier(span, text) => Some((span, text)),
            Name::Other(span) => {
                self.report(span, e::expected_name_identifier());
                None
            }
        }
    }

    // It is a GraphQL best practice to model all fields as nullable. This allows
    // the server to handle field level executions by simply returning null for
    // that field.
    // https://graphql.org/learn/best-practices/#nullability
    fn kills_parent_on_exception(&self, parent_node: TsNodeId) -> Option<NameNode> {
        self.jsdoc
            .get_js_doc_tags(parent_node)
            .into_iter()
            .find(|&tag| self.jsdoc.tag(tag).tag_name.text == KILLS_PARENT_ON_EXCEPTION_TAG)
            .map(|tag| {
                gql::name(
                    self.locatable(self.tag_name_span(tag)),
                    KILLS_PARENT_ON_EXCEPTION_TAG,
                )
            })
    }

    /* Helpers for reading oxc's AST and the JSDoc index built from it. */

    /// The oxc node a JSDoc index node was built from.
    fn kind(&self, node: TsNodeId) -> Option<AstKind<'a>> {
        let id = self.jsdoc.node(node).ast?;
        Some(self.file.semantic().nodes().kind(id))
    }

    fn ast(&self, node: TsNodeId) -> AstKind<'a> {
        self.kind(node).expect("Expected an oxc node")
    }

    /// The JSDoc index node of an oxc node.
    fn ts(&self, id: NodeId) -> TsNodeId {
        self.jsdoc
            .from_ast(id)
            .expect("Expected the node to be in the JSDoc index")
    }

    /// The span of a node, including any `export` and decorators, like
    /// TypeScript's `getStart()` and `getEnd()`.
    fn node_span(&self, node: TsNodeId) -> Span {
        let node = self.jsdoc.node(node);
        Span::new(node.start, node.end)
    }

    fn text(&self, span: Span) -> &'a str {
        &self.file.text[span.start as usize..span.end as usize]
    }

    /// Whether the declaration is exported, and if so, whether it's the
    /// default export.
    fn export_kind(&self, node: TsNodeId) -> Option<bool> {
        let id = self.jsdoc.node(node).ast?;
        match self.file.semantic().nodes().parent_kind(id) {
            AstKind::ExportDeclaration(_) => Some(false),
            AstKind::ExportDefaultDeclaration(_) => Some(true),
            _ => None,
        }
    }

    /// Whether the node is a statement of the source file.
    fn is_top_level(&self, node: TsNodeId) -> bool {
        self.jsdoc
            .node(node)
            .parent
            .is_some_and(|parent| self.jsdoc.node(parent).kind == SyntaxKind::SourceFile)
    }

    /// The declaration list of a variable statement in the JSDoc index, which
    /// oxc doesn't have.
    fn declaration_list(&self, statement: TsNodeId) -> TsNodeId {
        self.jsdoc
            .node(statement)
            .children
            .iter()
            .copied()
            .find(|&child| self.jsdoc.node(child).kind == SyntaxKind::VariableDeclarationList)
            .expect("Expected a variable statement to have a declaration list")
    }

    /// The span of the `?` after `after`.
    fn question_token(&self, after: u32) -> Span {
        self.file
            .token_after(after)
            .map_or(Span::empty(after), Token::span)
    }

    /// The span of a modifier keyword between `from` and `to`, since oxc
    /// records modifiers as flags.
    fn modifier_span(&self, from: u32, to: u32, modifier: Kind) -> Span {
        self.file
            .find_token(from, to, modifier)
            .unwrap_or(Span::new(from, to))
    }

    /// The span of an element of an array literal. Like TypeScript's
    /// `OmittedExpression`, an elision is empty, at the end of the token
    /// before it.
    fn array_element_span(&self, element: &ArrayExpressionElement<'a>) -> Span {
        match element {
            ArrayExpressionElement::Elision(elision) => {
                Span::empty(self.file.full_start(elision.span.start))
            }
            _ => element.span(),
        }
    }

    fn property_like(&self, node: Member<'a>) -> Option<PropertyLike<'a>> {
        match node {
            Member::Class(ClassElement::PropertyDefinition(property)) => Some(PropertyLike {
                span: property.span,
                id: property.node_id(),
                key: &property.key,
                computed: property.computed,
                type_annotation: property.type_annotation.as_deref(),
                optional: property.optional,
            }),
            // An `accessor` can't be optional.
            Member::Class(ClassElement::AccessorProperty(property)) => Some(PropertyLike {
                span: property.span,
                id: property.node_id(),
                key: &property.key,
                computed: property.computed,
                type_annotation: property.type_annotation.as_deref(),
                optional: false,
            }),
            Member::Type(TSSignature::TSPropertySignature(property)) => Some(PropertyLike {
                span: property.span,
                id: property.node_id(),
                key: &property.key,
                computed: property.computed,
                type_annotation: property.type_annotation.as_deref(),
                optional: property.optional,
            }),
            _ => None,
        }
    }

    /// The name of a member, if it has one.
    fn member_name(&self, member: Member<'a>) -> Option<Name<'a>> {
        match member {
            Member::Class(ClassElement::MethodDefinition(method))
                if method.kind != MethodDefinitionKind::Constructor =>
            {
                Some(key_name(self.file, &method.key, method.computed))
            }
            Member::Class(ClassElement::PropertyDefinition(property)) => {
                Some(key_name(self.file, &property.key, property.computed))
            }
            Member::Class(ClassElement::AccessorProperty(property)) => {
                Some(key_name(self.file, &property.key, property.computed))
            }
            Member::Type(TSSignature::TSPropertySignature(property)) => {
                Some(key_name(self.file, &property.key, property.computed))
            }
            Member::Type(TSSignature::TSMethodSignature(method)) => {
                Some(key_name(self.file, &method.key, method.computed))
            }
            _ => None,
        }
    }
}

type ArgDefaults<'a> = FxHashMap<&'a str, &'a Expression<'a>>;

#[derive(Clone, Copy, PartialEq)]
enum FieldTypeContext {
    Input,
    Output,
}

/// A type, unwrapped from any `Promise`.
struct UnwrappedType<'a> {
    r#type: &'a TSType<'a>,
    /// Whether it was a `Promise`.
    is_async: bool,
}

/// A name, like TypeScript's `PropertyName`, `BindingName` or `EntityName`:
/// an identifier, or another kind of name, which is reported.
#[derive(Clone, Copy)]
enum Name<'a> {
    Identifier(Span, &'a str),
    Other(Span),
}

impl Name<'_> {
    fn span(self) -> Span {
        match self {
            Name::Identifier(span, _) | Name::Other(span) => span,
        }
    }
}

/// A member of a class, or of an interface or type literal.
#[derive(Clone, Copy)]
enum Member<'a> {
    Class(&'a ClassElement<'a>),
    Type(&'a TSSignature<'a>),
}

/// The declaration whose heritage clauses are read.
#[derive(Clone, Copy)]
enum Heritage<'a> {
    Class(&'a Class<'a>),
    Interface(&'a TSInterfaceDeclaration<'a>),
    TypeAlias,
}

/// A parameter. Like TypeScript's, they include `this` and rest parameters.
#[derive(Clone, Copy)]
enum Param<'a> {
    This(&'a TSThisParameter<'a>),
    Item(&'a FormalParameter<'a>),
    Rest(&'a FormalParameterRest<'a>),
}

impl<'a> Param<'a> {
    fn span(self) -> Span {
        match self {
            Param::This(param) => param.span,
            Param::Item(param) => param.span,
            Param::Rest(param) => param.span,
        }
    }

    fn node_id(self) -> NodeId {
        match self {
            Param::This(param) => param.node_id(),
            Param::Item(param) => param.node_id(),
            Param::Rest(param) => param.node_id(),
        }
    }

    fn decorators(self) -> &'a [Decorator<'a>] {
        match self {
            Param::This(_) => &[],
            Param::Item(param) => &param.decorators,
            Param::Rest(param) => &param.decorators,
        }
    }

    fn type_annotation(self) -> Option<&'a TSTypeAnnotation<'a>> {
        match self {
            Param::This(param) => param.type_annotation.as_deref(),
            Param::Item(param) => param.type_annotation.as_deref(),
            Param::Rest(param) => param.type_annotation.as_deref(),
        }
    }

    fn initializer(self) -> Option<&'a Expression<'a>> {
        match self {
            Param::Item(param) => param.initializer.as_deref(),
            Param::This(_) | Param::Rest(_) => None,
        }
    }

    fn optional(self) -> bool {
        match self {
            Param::Item(param) => param.optional,
            Param::This(_) | Param::Rest(_) => false,
        }
    }

    fn name(self) -> Name<'a> {
        match self {
            Param::This(param) => Name::Identifier(param.this_span, "this"),
            Param::Item(param) => pattern_name(&param.pattern),
            Param::Rest(param) => pattern_name(&param.rest.argument),
        }
    }

    /// Where the modifiers start: after any decorators.
    fn modifiers_start(self) -> u32 {
        self.decorators()
            .last()
            .map_or(self.span().start, |decorator| decorator.span.end)
    }
}

/// A method, method signature or get accessor.
struct MethodLike<'a> {
    span: Span,
    id: NodeId,
    /// Where the modifiers start: after any decorators.
    modifiers_start: u32,
    accessibility: Option<TSAccessibility>,
    r#static: bool,
    key: &'a PropertyKey<'a>,
    computed: bool,
    /// Whether it's a method, rather than a get accessor.
    callable: bool,
    params: Vec<Param<'a>>,
    return_type: Option<&'a TSTypeAnnotation<'a>>,
}

/// A function declaration, method or arrow function.
struct FunctionLike<'a> {
    id: TsNodeId,
    params: Vec<Param<'a>>,
    return_type: Option<&'a TSTypeAnnotation<'a>>,
}

/// A function field's resolver parameters, GraphQL arguments, and the type
/// it's defined on.
struct AbstractFieldArgs {
    resolver_params: Vec<ResolverArgument>,
    args: Option<Vec<InputValueDefinitionNode>>,
    type_name: NameNode,
}

/// A property declaration, `accessor` or property signature.
struct PropertyLike<'a> {
    span: Span,
    id: NodeId,
    key: &'a PropertyKey<'a>,
    computed: bool,
    type_annotation: Option<&'a TSTypeAnnotation<'a>>,
    optional: bool,
}

fn method_like<'a>(node: Member<'a>) -> Option<MethodLike<'a>> {
    match node {
        Member::Class(ClassElement::MethodDefinition(method))
            if matches!(
                method.kind,
                MethodDefinitionKind::Method | MethodDefinitionKind::Get
            ) =>
        {
            Some(MethodLike {
                span: method.span,
                id: method.node_id(),
                modifiers_start: method
                    .decorators
                    .last()
                    .map_or(method.span.start, |decorator| decorator.span.end),
                accessibility: method.accessibility,
                r#static: method.r#static,
                key: &method.key,
                computed: method.computed,
                callable: method.kind == MethodDefinitionKind::Method,
                params: params(method.value.this_param.as_deref(), &method.value.params),
                return_type: method.value.return_type.as_deref(),
            })
        }
        Member::Type(TSSignature::TSMethodSignature(method))
            if matches!(
                method.kind,
                TSMethodSignatureKind::Method | TSMethodSignatureKind::Get
            ) =>
        {
            Some(MethodLike {
                span: method.span,
                id: method.node_id(),
                modifiers_start: method.span.start,
                accessibility: None,
                r#static: false,
                key: &method.key,
                computed: method.computed,
                callable: method.kind == TSMethodSignatureKind::Method,
                params: params(method.this_param.as_deref(), &method.params),
                return_type: method.return_type.as_deref(),
            })
        }
        _ => None,
    }
}

/// A function's parameters, including `this` and rest parameters.
fn params<'a>(
    this_param: Option<&'a TSThisParameter<'a>>,
    params: &'a FormalParameters<'a>,
) -> Vec<Param<'a>> {
    this_param
        .map(Param::This)
        .into_iter()
        .chain(params.items.iter().map(Param::Item))
        .chain(params.rest.as_deref().map(Param::Rest))
        .collect()
}

fn binding_name<'a>(id: &BindingIdentifier<'a>) -> Name<'a> {
    Name::Identifier(id.span, id.name.as_str())
}

fn pattern_name<'a>(pattern: &BindingPattern<'a>) -> Name<'a> {
    match pattern {
        BindingPattern::BindingIdentifier(id) => binding_name(id),
        _ => Name::Other(pattern.span()),
    }
}

fn type_name<'a>(name: &TSTypeName<'a>) -> Name<'a> {
    match name {
        TSTypeName::IdentifierReference(id) => Name::Identifier(id.span, id.name.as_str()),
        _ => Name::Other(name.span()),
    }
}

/// A property's name. Like TypeScript's `ComputedPropertyName`, a computed
/// name includes its brackets.
fn key_name<'a>(file: &ParsedFile, key: &PropertyKey<'a>, computed: bool) -> Name<'a> {
    if computed {
        return Name::Other(bracket_span(file, key.span()));
    }
    match key {
        PropertyKey::StaticIdentifier(id) => Name::Identifier(id.span, id.name.as_str()),
        _ => Name::Other(key.span()),
    }
}

/// The span of a computed name's brackets, around `expression`.
fn bracket_span(file: &ParsedFile, expression: Span) -> Span {
    let start = file
        .token_before(expression.start)
        .map_or(expression.start, Token::start);
    let end = file
        .token_after(expression.end)
        .map_or(expression.end, Token::end);
    Span::new(start, end)
}

fn accessibility_kind(accessibility: TSAccessibility) -> Kind {
    match accessibility {
        TSAccessibility::Public => Kind::Public,
        TSAccessibility::Private => Kind::Private,
        TSAccessibility::Protected => Kind::Protected,
    }
}

fn is_static_method(node: &ClassElement) -> bool {
    matches!(node, ClassElement::MethodDefinition(method) if is_static_method_definition(method))
}

fn is_static_method_definition(method: &MethodDefinition) -> bool {
    method.kind == MethodDefinitionKind::Method && method.r#static
}

fn is_nullish(node: &TSType) -> bool {
    matches!(
        node,
        TSType::TSNullKeyword(_) | TSType::TSUndefinedKeyword(_) | TSType::TSVoidKeyword(_)
    )
}

/// Like TypeScript's literal types, which include `null` and template
/// literals without substitutions.
fn is_literal_type(node: &TSType) -> bool {
    match node {
        TSType::TSLiteralType(_) | TSType::TSNullKeyword(_) => true,
        TSType::TSTemplateLiteralType(template) => template.types.is_empty(),
        _ => false,
    }
}

fn string_literal_type<'n, 'a>(node: &'n TSType<'a>) -> Option<&'n StringLiteral<'a>> {
    match node {
        TSType::TSLiteralType(literal) => match &literal.literal {
            TSLiteral::StringLiteral(literal) => Some(literal),
            _ => None,
        },
        _ => None,
    }
}

fn member_type_node_id(node: &TSType) -> NodeId {
    match node {
        TSType::TSLiteralType(literal) => literal.node_id(),
        _ => NodeId::DUMMY,
    }
}

/// `X` of `typeof X`, if `X` is an identifier.
fn type_query_identifier<'n>(node: &'n TSType) -> Option<&'n str> {
    let TSType::TSTypeQuery(query) = node else {
        return None;
    };
    match &query.expr_name {
        TSTypeQueryExprName::IdentifierReference(id) => Some(id.name.as_str()),
        _ => None,
    }
}

/// Given a variable declaration, extract the inner expression from an
/// `as const` or `as const satisfies T` assertion. Returns `None` if the
/// declaration doesn't use `as const`.
fn extract_as_const_expression<'a>(
    declaration: &'a VariableDeclarator<'a>,
) -> Option<&'a Expression<'a>> {
    let mut expr = declaration.init.as_ref()?;

    // Handle `X as const satisfies T` — the satisfies wraps the as-expression
    if let Expression::TSSatisfiesExpression(satisfies) = expr {
        expr = &satisfies.expression;
    }

    // Must be `X as const`
    let Expression::TSAsExpression(expr) = expr else {
        return None;
    };
    match &expr.type_annotation {
        TSType::TSTypeReference(reference)
            if matches!(
                &reference.type_name,
                TSTypeName::IdentifierReference(id) if id.name == "const"
            ) =>
        {
            Some(&expr.expression)
        }
        _ => None,
    }
}

/// The declarator of a statement which declares a single const, like
/// `const X = …`, and its name.
fn sole_const_declarator<'n, 'a>(
    statement: &'n Statement<'a>,
) -> Option<(&'n VariableDeclarator<'a>, &'n BindingIdentifier<'a>)> {
    let declaration = match statement {
        Statement::VariableDeclaration(declaration) => declaration,
        Statement::ExportDeclaration(export) => match &export.declaration {
            Declaration::VariableDeclaration(declaration) => declaration,
            _ => return None,
        },
        _ => return None,
    };
    // Like TypeScript's `Const` flag, which `await using` declarations share.
    if !matches!(
        declaration.kind,
        VariableDeclarationKind::Const | VariableDeclarationKind::AwaitUsing
    ) {
        return None;
    }
    let [declarator] = declaration.declarations.as_slice() else {
        return None;
    };
    match &declarator.id {
        BindingPattern::BindingIdentifier(name) => Some((declarator, name)),
        _ => None,
    }
}

/// An object literal's `key: value` property.
fn init_property<'n, 'a>(node: &'n ObjectPropertyKind<'a>) -> Option<&'n ObjectProperty<'a>> {
    match node {
        ObjectPropertyKind::ObjectProperty(property)
            if property.kind == PropertyKind::Init && !property.method && !property.shorthand =>
        {
            Some(property)
        }
        _ => None,
    }
}

fn graphql_name_validation_message(name: &str) -> Option<String> {
    assert_name(name).err().map(|error| error.message)
}

/// A JSDoc comment, as Grats' TypeScript implementation interpolated it into a
/// JavaScript template string. A list of comment parts becomes their objects'
/// strings, joined.
fn template_string(comment: Option<&JSDocComment>) -> String {
    match comment {
        Some(JSDocComment::Text(text)) => text.clone(),
        Some(JSDocComment::Parts(parts)) => vec!["[object Object]"; parts.len()].join(","),
        None => "undefined".to_string(),
    }
}
