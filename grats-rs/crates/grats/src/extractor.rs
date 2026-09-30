//! Port of `src/Extractor.ts`.
//!
//! PORT: The extractor reads the file's JSDoc (`jsdoc`), which follows
//! TypeScript's rules, and oxc's AST. Offsets are UTF-8 until locations are
//! made.

use std::collections::{HashMap, HashSet};

use graphql_js::language::ast::{
    ConstArgumentNode, ConstDirectiveNode, ConstListValueNode, ConstObjectFieldNode,
    ConstObjectValueNode, ConstValueNode, DefinitionNode, DiagnosticHandle, DiagnosticHandleResult,
    EnumValueDefinitionNode, ExportDefinition, FieldDefinitionNode, InputValueDefinitionNode,
    InputValueDefinitionNodeOrResolverArg, NameNode, NamedTypeNode, ResolverArgument,
    ResolverSignature, StringValueNode, TypeNode,
};
use graphql_js::language::parser::{ParseResult, Parser};
use graphql_js::language::source::{DEFAULT_SOURCE_NAME, Source};
use graphql_js::language::token_kind::TokenKind;
use graphql_js::r#type::assert_name::assert_name;
use indexmap::IndexMap;
use oxc_ast::AstKind;
use oxc_ast::ast::{
    ArrayExpression, ArrayExpressionElement, BindingIdentifier, BindingPattern, ChainElement,
    Class, ClassElement, ClassType, Declaration, Decorator, Expression, FormalParameter,
    FormalParameterRest, FormalParameters, Function, MethodDefinition, MethodDefinitionKind,
    ObjectExpression, ObjectPattern, ObjectPropertyKind, PropertyKey, PropertyKind, Statement,
    StringLiteral, TSEnumDeclaration, TSEnumMemberName, TSIndexedAccessType,
    TSInterfaceDeclaration, TSLiteral, TSMethodSignatureKind, TSPropertySignature, TSSignature,
    TSThisParameter, TSType, TSTypeAliasDeclaration, TSTypeAnnotation, TSTypeName,
    TSTypeOperatorOperator, TSTypeParameterInstantiation, TSTypeQueryExprName, TSTypeReference,
    VariableDeclaration, VariableDeclarationKind, VariableDeclarator,
};
use oxc_span::{GetSpan, Span};
use oxc_syntax::node::NodeId;
use oxc_syntax::number::ToJsString;

use crate::code_actions as act;
use crate::comments::detect_invalid_comments;
use crate::errors as e;
use crate::files::ParsedFile;
use crate::graphql_constructor::{GraphQLConstructor, loc};
use crate::grats_config::GratsConfig;
use crate::grats_root::relative_path;
use crate::jsdoc::{
    JSDocComment, JSDocCommentPart, JSDocIndex, JSDocOrTag, SyntaxKind, TagId, TsNodeId,
    full_start, get_text_of_js_doc_comment, is_js_white_space, js_trim, skip_trivia,
};
use crate::snapshot_refs::{
    DeclLoc, DeclRef, EntityName, EntityNameRef, decl_ref, entity_name_ref,
};
use crate::source_table::SourceTable;
use crate::type_context::{
    DeclarationDefinition, DeclarationDefinitionKind, DerivedResolverDefinition,
    UNRESOLVED_REFERENCE_NAME,
};
use crate::utils::diagnostic_error::{
    CodeFixAction, Diagnostic, DiagnosticRelatedInformation, DiagnosticsResult, TsLocatableNode,
    gql_err, ts_err, ts_related,
};
use crate::utils::helpers::{TsIdentifier, best_match, levenshtein_distance, unique_id};

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

/// PORT: `[...ALL_GQL_TAGS, KILLS_PARENT_ON_EXCEPTION_TAG, ONE_OF_TAG]`, spelled
/// out since arrays can't be spread in a `const`.
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

#[derive(Debug)]
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
    pub types_with_typename: HashSet<String>,

    /// TypeScript interfaces which have been used to define GraphQL types. This is
    /// used in a later validation pass to ensure we never use merged interfaces,
    /// since merged interfaces have surprising behaviors which can lead to bugs.
    pub interface_declarations: Vec<DeclRef>,

    /// PORT: The diagnostics which `DiagnosticHandle`s in `definitions`
    /// refer to, which TypeScript holds directly.
    pub diagnostics_by_handle: HashMap<DiagnosticHandle, Diagnostic>,
}

/// PORT: `{ declaration: DeclRef; definition: NameDefinition }`.
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
/// PORT: Takes the config's `tsClientEnums`, as TypeScript does, with the
/// rest of it. `grats_root` and `sources` are the context which TypeScript's
/// module-level state provides: the root which exported paths are relative
/// to, and the `SourceTable` of the `@gqlAnnotate` tags' GraphQL sources.
pub fn extract(
    source_file: &ParsedFile,
    config: &GratsConfig,
    grats_root: &str,
    sources: &SourceTable,
) -> DiagnosticsResult<ExtractionSnapshot> {
    let extractor = Extractor::new(source_file, config, grats_root, sources);
    extractor.extract()
}

struct Extractor<'f, 'a> {
    // Snapshot data. See comments on fields on ExtractionSnapshot for details.
    definitions: Vec<DefinitionNode>,
    unresolved_names: IndexMap<TsIdentifier, EntityNameRef>,
    name_definitions: IndexMap<DeclLoc, NameDefinitionEntry>,
    implicit_name_definitions: Vec<(DeclarationDefinition, EntityNameRef)>,
    types_with_typename: HashSet<String>,
    interface_declarations: Vec<DeclRef>,

    errors: Vec<Diagnostic>,
    gql: GraphQLConstructor,
    config: &'f GratsConfig,

    /// PORT: The file being extracted, which TypeScript's nodes refer to.
    file: &'f ParsedFile<'a>,
    /// PORT: The JSDoc of `file`.
    jsdoc: &'f JSDocIndex,
    grats_root: &'f str,
    sources: &'f SourceTable,
    /// PORT: See `ExtractionSnapshot::diagnostics_by_handle`.
    diagnostics_by_handle: HashMap<DiagnosticHandle, Diagnostic>,
}

impl<'f, 'a> Extractor<'f, 'a> {
    fn new(
        file: &'f ParsedFile<'a>,
        config: &'f GratsConfig,
        grats_root: &'f str,
        sources: &'f SourceTable,
    ) -> Self {
        Extractor {
            definitions: Vec::new(),
            unresolved_names: IndexMap::new(),
            name_definitions: IndexMap::new(),
            implicit_name_definitions: Vec::new(),
            types_with_typename: HashSet::new(),
            interface_declarations: Vec::new(),
            errors: Vec::new(),
            gql: GraphQLConstructor,
            config,
            file,
            jsdoc: file.jsdoc(),
            grats_root,
            sources,
            diagnostics_by_handle: HashMap::new(),
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
        let mut seen_comment_positions: HashSet<u32> = HashSet::new();
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
                    let one_of = self.find_tag(node, ONE_OF_TAG);
                    if let Some(one_of) = one_of {
                        self.report(
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
                        self.report(
                            self.tag_span(tag),
                            e::context_tag_on_non_declaration(),
                            None,
                            None,
                        );
                    } else if jsdoc.node(node).kind == SyntaxKind::FunctionDeclaration {
                        self.record_derived_context(node, tag);
                    } else {
                        let name = self
                            .gql
                            .name(self.locatable(self.tag_span(tag)), "CONTEXT_DUMMY_NAME");
                        self.record_type_name(node, name, DeclarationDefinitionKind::Context);
                    }
                }
                INFO_TAG => {
                    if jsdoc.node(node).kind != SyntaxKind::TypeAliasDeclaration {
                        self.report(self.tag_span(tag), e::user_defined_info_tag(), None, None);
                    } else {
                        let name = self
                            .gql
                            .name(self.locatable(self.tag_span(tag)), "INFO_DUMMY_NAME");
                        self.record_type_name(node, name, DeclarationDefinitionKind::Info);
                    }
                }
                KILLS_PARENT_ON_EXCEPTION_TAG => {
                    if !(self.has_tag(node, FIELD_TAG)
                        || self.has_tag(node, QUERY_FIELD_TAG)
                        || self.has_tag(node, MUTATION_FIELD_TAG)
                        || self.has_tag(node, SUBSCRIPTION_FIELD_TAG))
                    {
                        self.report(
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
                    let comment = template_string(jsdoc.tag(tag).comment.as_ref());
                    self.report(
                        self.tag_span(tag),
                        e::specified_by_deprecated(),
                        Some(vec![]),
                        Some(CodeFixAction {
                            fix_name: "replace-specifiedBy-with-gqlAnnotate".to_string(),
                            description: "Replace @specifiedBy with @gqlAnnotate".to_string(),
                            changes: vec![act::replace_node(
                                self.locatable(self.tag_span(tag)),
                                &format!("@gqlAnnotate specifiedBy(url: \"{comment}\")"),
                            )],
                        }),
                    );
                }
                _ => {
                    let lower_case_tag = tag_name.to_lowercase();
                    if lower_case_tag.starts_with("gql") {
                        let mut reported = false;
                        if tag_name == IMPLEMENTS_TAG_DEPRECATED {
                            self.report(
                                self.tag_name_span(tag),
                                e::implements_tag_deprecated(),
                                None,
                                None,
                            );
                            return;
                        }
                        for t in ALL_GQL_TAGS {
                            if t.to_lowercase() == lower_case_tag {
                                self.report(
                                    self.tag_name_span(tag),
                                    e::wrong_casing_for_grats_tag(tag_name, t),
                                    Some(vec![]),
                                    Some(CodeFixAction {
                                        fix_name: "fix-grats-tag-casing".to_string(),
                                        description: format!("Change to @{t}"),
                                        changes: vec![act::replace_node(
                                            self.locatable(self.tag_name_span(tag)),
                                            t,
                                        )],
                                    }),
                                );
                                reported = true;
                                break;
                            }
                        }
                        if !reported {
                            let suggested = best_match(&ALL_GQL_TAGS, |t| {
                                -(levenshtein_distance(t, tag_name) as i64)
                            });

                            self.report(
                                self.tag_name_span(tag),
                                e::invalid_grats_tag(tag_name),
                                Some(vec![]),
                                Some(CodeFixAction {
                                    fix_name: format!("change-to-{suggested}"),
                                    description: format!("Change to @{suggested}"),
                                    changes: vec![act::replace_node(
                                        self.locatable(self.tag_name_span(tag)),
                                        suggested,
                                    )],
                                }),
                            );
                        }
                    }
                }
            }
        });
        let errors = detect_invalid_comments(self.file, &seen_comment_positions);
        self.errors.extend(errors);

        if !self.errors.is_empty() {
            return Err(self.errors);
        }
        Ok(ExtractionSnapshot {
            definitions: self.definitions,
            unresolved_names: self.unresolved_names.into_iter().collect(),
            name_definitions: self.name_definitions.into_iter().collect(),
            implicit_name_definitions: self.implicit_name_definitions,
            types_with_typename: self.types_with_typename,
            interface_declarations: self.interface_declarations,
            diagnostics_by_handle: self.diagnostics_by_handle,
        })
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
                        None,
                        None,
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
                        self.report(
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
                        self.report(
                            self.tag_name_span(tag),
                            e::gql_field_parent_missing_tag(),
                            None,
                            None,
                        );
                    }
                    Some(_) => {}
                }
            }
        }
    }

    /// PORT: Reads the JSDoc index's nodes, whose kinds and parents are
    /// TypeScript's.
    fn get_field_parent(&self, node: TsNodeId) -> Option<TsNodeId> {
        let node_data = self.jsdoc.node(node);
        let parent = node_data.parent?;
        match node_data.kind {
            SyntaxKind::MethodDeclaration
            | SyntaxKind::GetAccessor
            | SyntaxKind::PropertyDeclaration => Some(parent),
            SyntaxKind::Parameter => {
                if self.jsdoc.node(parent).kind == SyntaxKind::Constructor {
                    return self.jsdoc.node(parent).parent;
                }
                None
            }
            SyntaxKind::PropertySignature | SyntaxKind::MethodSignature => {
                let parent_data = self.jsdoc.node(parent);
                if parent_data.kind == SyntaxKind::TypeLiteral
                    && let Some(grandparent) = parent_data.parent
                    && self.jsdoc.node(grandparent).kind == SyntaxKind::TypeAliasDeclaration
                {
                    return Some(grandparent);
                } else if parent_data.kind == SyntaxKind::InterfaceDeclaration {
                    return Some(parent);
                }
                None
            }
            _ => None,
        }
    }

    fn extract_interface(&mut self, node: TsNodeId, tag: TagId) {
        if let Some(AstKind::TSInterfaceDeclaration(decl)) = self.kind(node) {
            self.interface_interface_declaration(node, decl, tag);
        } else {
            self.report(
                self.tag_span(tag),
                e::invalid_interface_tag_usage(),
                None,
                None,
            );
        }
    }

    fn extract_union(&mut self, node: TsNodeId, tag: TagId) {
        if let Some(AstKind::TSTypeAliasDeclaration(decl)) = self.kind(node) {
            self.union_type_alias_declaration(node, decl, tag);
        } else {
            self.report(self.tag_span(tag), e::invalid_union_tag_usage(), None, None);
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
            _ => self.report(self.tag_span(tag), e::invalid_input_tag_usage(), None, None),
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
                None,
                None,
            );
        };

        // Check if the return type is Promise<T> and unwrap it
        let Some(unwrapped) = self.maybe_unwrap_promise_type(&return_type.type_annotation) else {
            return;
        };
        let UnwrappedType {
            r#type: inner_type,
            is_async,
        } = unwrapped;

        let TSType::TSTypeReference(inner_type) = inner_type else {
            return self.report(
                inner_type.span(),
                e::missing_return_type_for_derived_resolver(),
                None,
                None,
            );
        };

        let func_name = self.named_function_export_name(node, function);

        if !self.is_top_level(node) {
            return self.report(
                self.node_span(node),
                e::function_field_not_top_level(),
                None,
                None,
            );
        }

        let ts_module_path = relative_path(self.grats_root, &self.file.path);

        let Some((resolver_params, _)) =
            self.resolver_params(&params(function.this_param.as_deref(), &function.params))
        else {
            return;
        };

        let name = self
            .gql
            .name(self.locatable(self.tag_span(tag)), "CONTEXT_DUMMY_NAME");
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

    /// PORT: When the comment has parts, TypeScript reads the text parts'
    /// source text, which differs from their text across lines. But a comment
    /// only has parts if one of them is a link, which is reported, so the text
    /// is never read.
    fn extract_docblock_tag_comment(&mut self, comment: &JSDocComment) -> Option<String> {
        let parts = match comment {
            JSDocComment::Text(comment) => return Some(comment.clone()),
            JSDocComment::Parts(parts) => parts,
        };
        let mut text = String::new();
        let mut has_errors = false;
        for tag in parts {
            match tag {
                JSDocCommentPart::Text(part) => text.push_str(part),
                JSDocCommentPart::Link { pos, end, .. } => {
                    self.report(
                        Span::new(*pos, *end),
                        e::directive_tag_comment_not_text(),
                        None,
                        None,
                    );
                    has_errors = true;
                }
            }
        }
        if has_errors {
            return None;
        }
        Some(text)
    }

    fn extract_directive(&mut self, node: TsNodeId, tag: TagId) {
        match self.kind(node) {
            Some(AstKind::Function(function))
                if self.jsdoc.node(node).kind == SyntaxKind::FunctionDeclaration =>
            {
                self.extract_directive_function(node, function, tag);
            }
            _ => self.report(
                self.tag_span(tag),
                e::directive_tag_on_wrong_node(),
                None,
                None,
            ),
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
            self.report(
                self.tag_span(tag),
                e::directive_tag_no_comment(),
                None,
                None,
            );
            return;
        };
        let Some(comment) = self.extract_docblock_tag_comment(tag_comment) else {
            return;
        };

        let tag_loc = loc(self.locatable(self.tag_span(tag)));
        let tag_data = self.parse_gql(self.tag_span(tag), comment, |parser| {
            let mut name: Option<NameNode> = None;
            let mut repeatable = parser.expect_optional_keyword("repeatable")?;
            let on = parser.expect_optional_keyword("on")?;

            // If the first identifier was neither `repeatable` nor `on`, then
            // we expect it to be the directive name.
            if !on && !repeatable {
                name = Some(NameNode {
                    loc: Some(tag_loc),
                    ..parser.parse_name()?
                });
                repeatable = parser.expect_optional_keyword("repeatable")?;
                parser.expect_keyword("on")?;
            }

            let locations = parser
                .parse_directive_locations()?
                .into_iter()
                .map(|location| NameNode {
                    loc: Some(tag_loc),
                    ..location
                })
                .collect::<Vec<_>>();
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
                    return self.report(
                        self.node_span(node),
                        e::directive_function_not_named(),
                        None,
                        None,
                    );
                };
                let Some((id_span, id)) = self.expect_name_identifier(binding_name(id)) else {
                    return;
                };
                self.gql.name(self.locatable(id_span), id)
            }
        };

        let definition = self.gql.directive_definition(
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
            self.report(param.span(), e::directive_argument_not_object(), None, None);
            return None;
        };
        if let TSType::TSNeverKeyword(_) = &param_type.type_annotation {
            return None;
        }
        let TSType::TSTypeLiteral(literal) = &param_type.type_annotation else {
            self.report(param.span(), e::directive_argument_not_object(), None, None);
            return None;
        };
        let mut defaults: Option<ArgDefaults<'a>> = None;
        if let Param::Item(item) = param
            && let BindingPattern::ObjectPattern(pattern) = &item.pattern
        {
            defaults = Some(self.collect_arg_defaults(pattern));
        }

        let mut args: Vec<InputValueDefinitionNode> = Vec::new();
        for member in &literal.members {
            let arg = self.collect_arg(member, defaults.as_ref());
            if let Some(arg) = arg {
                args.push(arg);
            }
        }
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
            _ => self.report(self.tag_span(tag), e::invalid_type_tag_usage(), None, None),
        }
    }

    fn extract_scalar(&mut self, node: TsNodeId, tag: TagId) {
        if let Some(AstKind::TSTypeAliasDeclaration(decl)) = self.kind(node) {
            self.scalar_type_alias_declaration(node, decl, tag);
        } else {
            self.report(
                self.tag_span(tag),
                e::invalid_scalar_tag_usage(),
                None,
                None,
            );
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
            _ => self.report(self.tag_span(tag), e::invalid_enum_tag_usage(), None, None),
        }
    }

    /// PORT: Takes the span of the node, since TypeScript's nodes and oxc's
    /// are reported alike.
    fn report(
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

        if tags.is_empty() {
            return None;
        }
        if tags.len() > 1 {
            let additional_tags = tags[1..]
                .iter()
                .map(|&tag| {
                    ts_related(
                        self.locatable(self.tag_span(tag)),
                        "Additional tag".to_string(),
                    )
                })
                .collect();

            self.report(
                self.tag_span(tags[0]),
                e::duplicate_tag(tag_name),
                Some(additional_tags),
                Some(CodeFixAction {
                    fix_name: "remove-duplicate-tag".to_string(),
                    description: format!("Remove duplicate @{tag_name} tag"),
                    changes: tags[1..]
                        .iter()
                        .map(|&tag| act::remove_node(self.locatable(self.tag_span(tag))))
                        .collect(), // Remove all but the first tag
                }),
            );
            return None;
        }
        Some(tags[0])
    }

    fn has_tag(&self, node: TsNodeId, tag_name: &str) -> bool {
        self.jsdoc
            .get_js_doc_tags(node)
            .into_iter()
            .any(|tag| self.jsdoc.tag(tag).tag_name.text == tag_name)
    }

    /// PORT: A span in this file, as a node which diagnostics can locate.
    fn locatable(&self, span: Span) -> TsLocatableNode<'f> {
        TsLocatableNode::new(self.file, span)
    }

    /// PORT: The span of a JSDoc tag, from its `@`.
    fn tag_span(&self, tag: TagId) -> Span {
        let tag = self.jsdoc.tag(tag);
        Span::new(tag.pos, tag.end)
    }

    /// PORT: The span of a JSDoc tag's name, after its `@`.
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
        self.report(span, completed_message, related_information, None);
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
                    let named_type = self.gql.named_type(
                        self.locatable(member.type_name.span()),
                        UNRESOLVED_REFERENCE_NAME,
                    );
                    self.mark_unresolved_type(EntityName::TypeReference(member), &named_type.name);
                    let member = self.union_member_declaration(member);
                    types.push(member);
                }
            }
            TSType::TSTypeReference(member) => {
                let member = self.union_member_declaration(member);
                types.push(member);
            }
            _ => {
                return self.report(
                    self.node_span(node),
                    e::expected_union_type_node(),
                    None,
                    None,
                );
            }
        }

        let description = self.collect_description(node);

        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::Union);

        let directives = self.collect_directives(node);

        let definition = self.gql.union_type_definition(
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
        let named_type = self.gql.named_type(
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
                None,
                None,
            );
        }
        let declaration = &statement.declarations[0];

        // PORT: TypeScript's `NodeFlags.Const` is also set for `await using`.
        if !matches!(
            statement.kind,
            VariableDeclarationKind::Const | VariableDeclarationKind::AwaitUsing
        ) {
            // Looks like there's no good way to find the location range of the `let`
            // or `var` keyword.
            return self.report(
                self.node_span(self.declaration_list(node)),
                e::exported_arrow_function_not_const(),
                None,
                None,
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
                None,
                None,
            );
        }

        let Some(Expression::ArrowFunctionExpression(initializer)) = &declaration.init else {
            return self.report(
                self.node_span(node),
                e::field_variable_is_not_arrow_function(),
                None,
                None,
            );
        };

        let is_exported = self.export_kind(node).is_some();

        if !is_exported {
            return self.report(
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
            return self.report(
                self.node_span(node),
                e::function_field_not_top_level(),
                None,
                None,
            );
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
                return self.report(
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
            return self.report(
                class_blame_node,
                e::static_method_class_not_top_level(),
                Some(related),
                None,
            );
        }

        let mut export_name: Option<(Span, &'a str)> = None;

        let Some(is_default) = self.export_kind(class_node) else {
            let related = field_defined_here();
            return self.report(
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

        if !is_default {
            let Some(class_name) = &class.id else {
                let related = field_defined_here();
                return self.report(
                    class_blame_node,
                    e::static_method_class_with_named_export_not_named(),
                    Some(related),
                    None,
                );
            };
            let Some(class_name) = self.expect_name_identifier(binding_name(class_name)) else {
                return;
            };

            export_name = Some(class_name);
        }

        let method = FunctionLike {
            id: node,
            params: params(method.value.this_param.as_deref(), &method.value.params),
            return_type: method.value.return_type.as_deref(),
        };
        self.collect_abstract_field(method, export_name, Some(method_name), name, parent_type);
    }

    /// Runs the parser code in `cb` over the source text and reports any errors at
    /// `node`.
    ///
    /// Ideally we could use GraphQL `Source` with a `locationOffset`, but for
    /// parsing text in docblocks which might span multiple lines, it's not as
    /// simple as providing an offset since the lines in the source text might be
    /// prefixed with indentation and `*`s.
    ///
    /// PORT: The source is added to the `SourceTable`, so that locations can
    /// refer to it.
    fn parse_gql<T>(
        &mut self,
        node: Span,
        source: String,
        cb: impl FnOnce(&mut Parser) -> ParseResult<T>,
    ) -> Option<T> {
        let id = self.sources.add(DEFAULT_SOURCE_NAME, &source);
        let source = Source::new(source, DEFAULT_SOURCE_NAME.to_string(), id);
        let mut parser = Parser::new(&source);
        let result: ParseResult<T> = (|| {
            parser.expect_token(TokenKind::Sof)?;
            let result = cb(&mut parser)?;
            parser.expect_token(TokenKind::Eof)?;
            Ok(result)
        })();
        match result {
            Ok(result) => Some(result),
            Err(err) => {
                self.report(node, err.message, None, None);
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
            let Some(JSDocComment::Text(comment)) = &tag_data.comment else {
                self.report(
                    self.tag_span(tag),
                    "Expected docblock tag to have a value.".to_string(),
                    None,
                    None,
                );
                continue;
            };
            let directive_text = format!("@{comment}");
            let directive = self.parse_gql(self.tag_span(tag), directive_text, |parser| {
                parser.parse_const_directive()
            });
            if let Some(directive) = directive {
                directives.push(ConstDirectiveNode {
                    loc: Some(loc(self.locatable(self.tag_span(tag)))),
                    ..directive
                });
            }
        }

        let tag = self.find_tag(node, DEPRECATED_TAG);
        if let Some(tag) = tag {
            let mut reason: Option<ConstArgumentNode> = None;
            let comment = self.jsdoc.tag(tag).comment.as_ref();
            if comment.is_some() {
                let reason_comment = get_text_of_js_doc_comment(comment);
                if let Some(reason_comment) = reason_comment {
                    // FIXME: Use the _value_'s location not the tag's
                    let tag_node = self.locatable(self.tag_span(tag));
                    reason = Some(self.gql.const_argument(
                        tag_node,
                        self.gql.name(tag_node, "reason"),
                        ConstValueNode::StringValue(self.gql.string(
                            tag_node,
                            &reason_comment,
                            None,
                        )),
                    ));
                }
            }

            directives.push(
                self.gql.const_directive(
                    self.locatable(self.tag_name_span(tag)),
                    self.gql
                        .name(self.locatable(self.node_span(node)), DEPRECATED_TAG),
                    reason.map(|reason| vec![reason]),
                ),
            );
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

        let ts_module_path = relative_path(self.grats_root, &self.file.path);

        let directives = self.collect_directives(node.id);

        let description = self.collect_description(node.id);

        let kills_parent_on_exception = self.kills_parent_on_exception(node.id);

        let export_name = export_name.map(|(_, export_name)| export_name.to_string());
        let field = self.gql.field_definition(
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
        let definition = self.gql.abstract_field_definition(
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
                type_name: self
                    .gql
                    .name(self.locatable(self.node_span(node.id)), parent_type),
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

        let mut resolver_params: Vec<ResolverArgument> = vec![ResolverArgument::Source {
            loc: Some(loc(self.locatable(type_param.span()))),
        }];
        resolver_params.extend(params);
        Some(AbstractFieldArgs {
            type_name,
            args,
            resolver_params,
        })
    }

    fn type_reference_from_param(&mut self, type_param: Param<'a>) -> Option<NameNode> {
        let Some(param_type) = type_param.type_annotation() else {
            self.report(
                type_param.span(),
                e::function_field_parent_type_missing(),
                None,
                None,
            );
            return None;
        };
        let TSType::TSTypeReference(reference) = &param_type.type_annotation else {
            self.report(
                param_type.type_annotation.span(),
                e::function_field_parent_type_not_valid(),
                None,
                None,
            );
            return None;
        };

        let type_name = self.gql.name(
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
            self.report(
                self.node_span(node),
                e::function_field_not_named(),
                None,
                None,
            );
            return None;
        };
        let Some(is_default) = self.export_kind(node) else {
            self.report(
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

        if is_default {
            return None;
        }
        Some((id.span, id.name.as_str()))
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

        let is_exported = self.export_kind(node).is_some();
        if !is_exported {
            self.report(
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
            ts_module_path: relative_path(self.grats_root, &self.file.path),
            export_name: Some(decl.id.name.to_string()),
        };

        let definition = self.gql.scalar_type_definition(
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

        let fields: Option<Vec<InputValueDefinitionNode>>;

        let mut directives = self.collect_directives(node);
        if let TSType::TSUnionType(union) = &decl.type_annotation {
            directives.push(self.gql.const_directive(
                self.locatable(self.node_span(node)),
                self.gql.name(self.locatable(union.span), ONE_OF_TAG),
                Some(vec![]),
            ));

            fields = self.extract_one_of_input_fields(union.types.iter());
        } else {
            fields = self.collect_input_fields(node, decl);
        }

        let Some(fields) = fields else { return };

        let definition = self.gql.input_object_type_definition(
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

        let mut fields: Vec<InputValueDefinitionNode> = Vec::new();

        for member in &decl.body.body {
            let TSSignature::TSPropertySignature(member) = member else {
                self.report_unhandled(
                    member.span(),
                    "input field",
                    e::input_type_field_not_property(),
                    None,
                );
                continue;
            };
            if let Some(field) = self.collect_input_field(member) {
                fields.push(field);
            }
        }

        self.interface_declarations
            .push(decl_ref(self.file, self.ast(node), self.node_span(node)));

        let directives = self.collect_directives(node);

        let definition = self.gql.input_object_type_definition(
            self.locatable(self.node_span(node)),
            name,
            Some(fields),
            Some(directives),
            description,
        );
        self.definitions
            .push(DefinitionNode::InputObjectTypeDefinition(definition));
    }

    /// PORT: TypeScript first checks that the version of graphql-js supports
    /// `@oneOf` (16.9.0). The version ported here does.
    fn extract_one_of_input_fields(
        &mut self,
        types: impl Iterator<Item = &'a TSType<'a>>,
    ) -> Option<Vec<InputValueDefinitionNode>> {
        let mut fields: Vec<InputValueDefinitionNode> = Vec::new();
        for member in types {
            if let Some(field) = self.collect_one_of_input_field(member) {
                fields.push(field);
            }
        }

        Some(fields)
    }

    fn collect_one_of_input_field(
        &mut self,
        node: &'a TSType<'a>,
    ) -> Option<InputValueDefinitionNode> {
        let TSType::TSTypeLiteral(literal) = node else {
            self.report(
                node.span(),
                e::one_of_field_not_type_literal_with_one_property(),
                None,
                None,
            );
            return None;
        };
        if literal.members.len() != 1 {
            self.report(
                node.span(),
                e::one_of_field_not_type_literal_with_one_property(),
                None,
                None,
            );
            return None;
        }

        let property = &literal.members[0];
        let TSSignature::TSPropertySignature(property) = property else {
            self.report(
                property.span(),
                e::one_of_field_not_type_literal_with_one_property(),
                None,
                None,
            );
            return None;
        };

        let Some(property_type) = &property.type_annotation else {
            self.report(
                property.span,
                e::one_of_property_missing_type_annotation(),
                None,
                None,
            );
            return None;
        };

        let description = self.collect_description(self.ts(property.node_id()));
        let (name_span, name) =
            self.expect_name_identifier(key_name(self.file, &property.key, property.computed))?;

        let inner = self.collect_type(&property_type.type_annotation, FieldTypeContext::Input)?;

        // All fields must be nullable since only one will be present at a time.
        let r#type = self.gql.nullable_type(inner);
        Some(self.gql.input_value_definition(
            self.locatable(node.span()),
            self.gql.name(self.locatable(name_span), name),
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
        let mut fields: Vec<InputValueDefinitionNode> = Vec::new();

        let TSType::TSTypeLiteral(literal) = &decl.type_annotation else {
            self.report_unhandled(
                self.node_span(node),
                "input",
                e::input_type_not_literal(),
                None,
            );
            return None;
        };

        for member in &literal.members {
            let TSSignature::TSPropertySignature(member) = member else {
                self.report_unhandled(
                    member.span(),
                    "input field",
                    e::input_type_field_not_property(),
                    None,
                );
                continue;
            };
            if let Some(field) = self.collect_input_field(member) {
                fields.push(field);
            }
        }

        if fields.is_empty() {
            None
        } else {
            Some(fields)
        }
    }

    fn collect_input_field(
        &mut self,
        node: &'a TSPropertySignature<'a>,
    ) -> Option<InputValueDefinitionNode> {
        let (id_span, id) =
            self.expect_name_identifier(key_name(self.file, &node.key, node.computed))?;

        let Some(node_type) = &node.type_annotation else {
            self.report(node.span, e::input_field_untyped(), None, None);
            return None;
        };

        let inner = self.collect_type(&node_type.type_annotation, FieldTypeContext::Input)?;

        let r#type = if !node.optional {
            inner
        } else {
            self.gql.nullable_type(inner).into()
        };

        let description = self.collect_description(self.ts(node.node_id()));

        let directives = self.collect_directives(self.ts(node.node_id()));

        Some(self.gql.input_value_definition(
            self.locatable(node.span),
            self.gql.name(self.locatable(id_span), id),
            r#type,
            Some(directives),
            None,
            description,
        ))
    }

    fn type_class_declaration(&mut self, node: TsNodeId, class: &'a Class<'a>, tag: TagId) {
        let Some(class_name) = &class.id else {
            return self.report(
                self.node_span(node),
                e::type_tag_on_unnamed_class(),
                None,
                None,
            );
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

        let mut exported: Option<ExportDefinition> = None;
        if !has_type_name && let Some(is_default) = self.export_kind(node) {
            exported = Some(ExportDefinition {
                ts_module_path: relative_path(self.grats_root, &self.file.path),
                export_name: if is_default {
                    None
                } else {
                    Some(class_name.name.to_string())
                },
            });
        }

        let directives = self.collect_directives(node);

        let definition = self.gql.object_type_definition(
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
            self.report(node, e::operation_type_not_unknown(), None, None);
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

        let definition = self.gql.object_type_definition(
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

        let mut fields: Vec<FieldDefinitionNode> = Vec::new();
        let mut interfaces: Option<Vec<NamedTypeNode>> = None;

        let mut has_type_name = false;

        match &decl.type_annotation {
            TSType::TSTypeLiteral(literal) => {
                self.validate_operation_types(literal.span, &name.value);
                let members: Vec<Member<'a>> = literal.members.iter().map(Member::Type).collect();
                fields = self.collect_fields(&members);
                interfaces = self.collect_interfaces(node, Heritage::TypeAlias);
                has_type_name = self.check_for_typename_property(&members, &name.value);
            }
            TSType::TSUnknownKeyword(_) => {
                // This is fine, we just don't know what it is. This should be the expected
                // case for operation types such as `Query`, `Mutation`, and `Subscription`
                // where there is not strong convention around.
            }
            other => {
                return self.report(
                    other.span(),
                    e::type_tag_on_alias_of_non_object_or_unknown(),
                    None,
                    None,
                );
            }
        }

        let description = self.collect_description(node);
        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::Type);

        let directives = self.collect_directives(node);

        let definition = self.gql.object_type_definition(
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
        let mut has_typename = false;
        for &member in members {
            if self.is_valid_type_name_property(member, expected_name) {
                has_typename = true;
                break;
            }
        }
        if has_typename {
            self.types_with_typename.insert(expected_name.to_string());
            return true;
        }
        false
    }

    fn is_valid_type_name_property(&mut self, member: Member<'a>, expected_name: &str) -> bool {
        let Some(name) = self.member_name(member) else {
            return false;
        };
        let Name::Identifier(name_span, "__typename") = name else {
            return false;
        };

        match member {
            Member::Class(ClassElement::PropertyDefinition(property)) => {
                return self.is_valid_typename_property_declaration(
                    property.span,
                    name_span,
                    property.type_annotation.as_deref(),
                    property.value.as_ref(),
                    expected_name,
                );
            }
            Member::Class(ClassElement::AccessorProperty(property)) => {
                return self.is_valid_typename_property_declaration(
                    property.span,
                    name_span,
                    property.type_annotation.as_deref(),
                    property.value.as_ref(),
                    expected_name,
                );
            }
            Member::Type(TSSignature::TSPropertySignature(property)) => {
                return self.is_valid_typename_property_signature(property, expected_name);
            }
            _ => {}
        }

        // TODO: Could show what kind we found, but TS AST does not have node names.
        self.report(name_span, e::type_name_not_declaration(), None, None);
        false
    }

    /// PORT: Takes the parts of the `PropertyDeclaration` which it reads,
    /// since oxc models `accessor` properties separately.
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
            self.report(
                node_name,
                e::type_name_missing_initializer(),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        };

        let Expression::TSAsExpression(initializer) = initializer else {
            self.report(
                initializer.span(),
                e::type_name_initialize_not_expression(expected_name),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        };

        let Expression::StringLiteral(expression) = &initializer.expression else {
            self.report(
                initializer.expression.span(),
                e::type_name_initialize_not_string(expected_name),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        };

        if expression.value != expected_name {
            self.report(
                expression.span,
                e::type_name_initializer_wrong(expected_name, &expression.value),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        }

        let TSType::TSTypeReference(initializer_type) = &initializer.type_annotation else {
            self.report(
                initializer.type_annotation.span(),
                e::type_name_type_not_reference_node(expected_name),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        };

        let TSTypeName::IdentifierReference(type_name) = &initializer_type.type_name else {
            self.report(
                initializer_type.type_name.span(),
                e::type_name_type_name_not_identifier(expected_name),
                Some(vec![]),
                Some(self.fix_typename_property(node, expected_name)),
            );
            return false;
        };

        if type_name.name != "const" {
            self.report(
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
            self.report(
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
        let literal = match node {
            TSType::TSLiteralType(literal) => match &literal.literal {
                TSLiteral::StringLiteral(literal) => Some(literal),
                _ => None,
            },
            _ => None,
        };
        let Some(literal) = literal else {
            self.report(
                node.span(),
                e::type_name_type_not_string_literal(expected_name),
                Some(vec![]),
                Some(self.fix_typename_type(node.span(), expected_name)),
            );
            return false;
        };
        if literal.value != expected_name {
            self.report(
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

        match heritage {
            Heritage::Class(_) | Heritage::Interface(_) => {
                self.collect_heritage_interfaces(heritage)
            }
            Heritage::TypeAlias => None,
        }
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
        self.report(self.tag_span(tag), message, None, None);
    }

    /// PORT: Classes' `implements` clauses and interfaces' `extends` clauses,
    /// which TypeScript filters its heritage clauses down to.
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

        let mut interfaces: Vec<NamedTypeNode> = Vec::new();
        for (expression, type_arguments) in types {
            let TSTypeName::IdentifierReference(expression) = expression else {
                continue;
            };
            let named_type = self
                .gql
                .named_type(self.locatable(expression.span), UNRESOLVED_REFERENCE_NAME);
            self.mark_unresolved_type(
                EntityName::ExpressionWithTypeArguments {
                    expression,
                    type_arguments,
                },
                &named_type.name,
            );
            interfaces.push(named_type);
        }

        if interfaces.is_empty() {
            return None;
        }

        Some(interfaces)
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

        let definition = self.gql.interface_type_definition(
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
                for param in params(method.value.this_param.as_deref(), &method.value.params) {
                    let field = self.constructor_param(param);
                    if let Some(field) = field {
                        fields.push(field);
                    }
                }
            }
            if let Some(method) = method_like(node) {
                let field = self.method_declaration(method);
                if let Some(field) = field {
                    fields.push(field);
                }
            } else if let Some(property) = self.property_like(node) {
                let field = self.property(property);
                if let Some(field) = field {
                    fields.push(field);
                }
            }
        }
        fields
    }

    fn constructor_param(&mut self, node: Param<'a>) -> Option<FieldDefinitionNode> {
        let tag = self.find_tag(self.ts(node.node_id()), FIELD_TAG)?;
        let modifiers = self.modifiers(node.modifiers_start(), node.modifiers_end());
        if node.decorators().is_empty() && modifiers.is_empty() {
            self.report(
                node.span(),
                e::parameter_without_modifiers(),
                Some(vec![]),
                Some(CodeFixAction {
                    fix_name: "add-public-modifier".to_string(),
                    description: "Add 'public' modifier".to_string(),
                    changes: vec![act::prefix_node(
                        self.locatable(node.name().span()),
                        "public ",
                    )],
                }),
            );
            return None;
        }

        let is_parameter_property = modifiers.iter().any(|&(modifier, _)| {
            matches!(modifier, "public" | "private" | "protected" | "readonly")
        });

        if !is_parameter_property {
            self.report(
                node.span(),
                e::parameter_without_modifiers(),
                Some(vec![]),
                Some(CodeFixAction {
                    fix_name: "add-public-modifier-to-existing".to_string(),
                    description: "Add 'public' modifier".to_string(),
                    changes: vec![act::prefix_node(
                        self.locatable(node.name().span()),
                        "public ",
                    )],
                }),
            );
            return None;
        }

        let not_public = modifiers
            .iter()
            .find(|&&(modifier, _)| matches!(modifier, "private" | "protected"));

        if let Some(&(_, not_public)) = not_public {
            self.report(
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
            self.report(
                node.span(),
                e::parameter_property_missing_type(),
                None,
                None,
            );
            return None;
        };

        let Name::Identifier(_, id) = node.name() else {
            // TypeScript triggers an error if a binding pattern is used for a
            // parameter property, so we don't need to report them.
            // https://www.typescriptlang.org/play?#code/MYGwhgzhAEBiD29oG8BQ1rHgOwgFwCcBXYPeAgCgAciAjEAS2BQDNEBfAShXdXaA
            return None;
        };
        let directives = self.collect_directives(self.ts(node.node_id()));

        let r#type = self.collect_type(&node_type.type_annotation, FieldTypeContext::Output)?;

        let description = self.collect_description(self.ts(node.node_id()));

        let kills_parent_on_exception = self.kills_parent_on_exception(self.ts(node.node_id()));

        Some(self.gql.field_definition(
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
        let mut defaults = HashMap::new();
        for element in &node.properties {
            if let BindingPattern::AssignmentPattern(initializer) = &element.value
                && !element.computed
                && let PropertyKey::StaticIdentifier(name) = &element.key
            {
                defaults.insert(name.name.as_str(), &initializer.right);
            }
        }
        defaults
    }

    fn collect_arg(
        &mut self,
        node: &'a TSSignature<'a>,
        defaults: Option<&ArgDefaults<'a>>,
    ) -> Option<InputValueDefinitionNode> {
        let TSSignature::TSPropertySignature(node) = node else {
            // TODO: How can I create this error?
            self.report(node.span(), e::arg_is_not_property(), None, None);
            return None;
        };
        let Name::Identifier(name_span, name_text) = key_name(self.file, &node.key, node.computed)
        else {
            // TODO: How can I create this error?
            let name = key_name(self.file, &node.key, node.computed);
            self.report(name.span(), e::arg_name_not_literal(), None, None);
            return None;
        };

        let Some(node_type) = &node.type_annotation else {
            self.report(name_span, e::arg_not_typed(), None, None);
            return None;
        };
        let mut r#type = self.collect_type(&node_type.type_annotation, FieldTypeContext::Input)?;

        if !matches!(r#type, TypeNode::NonNullType(_)) && !node.optional {
            // If a field is passed an argument value, and that argument is not defined in the request,
            // `graphql-js` will not define the argument property. Therefore we must ensure the argument
            // is not just nullable, but optional.
            self.report(
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

        let mut default_value: Option<ConstValueNode> = None;
        if let Some(defaults) = defaults {
            let def = defaults.get(name_text);
            if let Some(def) = def {
                default_value = self.collect_const_value(def);
            }
        }

        if node.optional && default_value.is_none() {
            // Question mark means we can handle the argument being undefined in the
            // object literal, but if we are going to type the GraphQL arg as
            // optional, the code must also be able to handle an explicit null.
            //
            // ... unless there is a default value. In that case, the default will be
            // used argument is omitted or references an undefined variable.

            // TODO: This will catch { a?: string } but not { a?: string | undefined }.
            if matches!(r#type, TypeNode::NonNullType(_)) {
                self.report(
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
            r#type = self.gql.nullable_type(r#type).into();
        }

        let description = self.collect_description(self.ts(node.node_id()));

        let directives = self.collect_directives(self.ts(node.node_id()));

        Some(self.gql.input_value_definition(
            self.locatable(node.span),
            self.gql.name(self.locatable(name_span), name_text),
            r#type,
            Some(directives),
            default_value,
            description,
        ))
    }

    fn collect_const_value(&mut self, node: &'a Expression<'a>) -> Option<ConstValueNode> {
        match node {
            Expression::StringLiteral(literal) => {
                return Some(ConstValueNode::StringValue(self.gql.string(
                    self.locatable(literal.span),
                    &literal.value,
                    None,
                )));
            }
            Expression::TemplateLiteral(literal) if literal.expressions.is_empty() => {
                let quasi = &literal.quasis[0].value;
                let text = quasi.cooked.as_ref().unwrap_or(&quasi.raw);
                return Some(ConstValueNode::StringValue(self.gql.string(
                    self.locatable(literal.span),
                    text,
                    None,
                )));
            }
            Expression::NumericLiteral(literal) => {
                // PORT: The text of a TypeScript numeric literal is its value
                // as JavaScript would print it.
                let text = literal.value.to_js_string();
                return Some(if text.contains('.') {
                    ConstValueNode::FloatValue(self.gql.float(self.locatable(literal.span), &text))
                } else {
                    ConstValueNode::IntValue(self.gql.int(self.locatable(literal.span), &text))
                });
            }
            Expression::Identifier(id) if id.name == "undefined" => {
                return Some(ConstValueNode::NullValue(
                    self.gql.null(self.locatable(id.span)),
                ));
            }
            Expression::NullLiteral(literal) => {
                return Some(ConstValueNode::NullValue(
                    self.gql.null(self.locatable(literal.span)),
                ));
            }
            Expression::BooleanLiteral(literal) => {
                return Some(ConstValueNode::BooleanValue(
                    self.gql
                        .boolean(self.locatable(literal.span), literal.value),
                ));
            }
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
                return Some(ConstValueNode::EnumValue(
                    self.gql
                        .r#enum(self.locatable(member.span), &member.property.name),
                ));
            }
            Expression::PrivateFieldExpression(member) => {
                return Some(ConstValueNode::EnumValue(self.gql.r#enum(
                    self.locatable(member.span),
                    &format!("#{}", member.field.name),
                )));
            }
            // PORT: TypeScript's property accesses include optional chains.
            Expression::ChainExpression(chain) => match &chain.expression {
                ChainElement::StaticMemberExpression(member) => {
                    return Some(ConstValueNode::EnumValue(
                        self.gql
                            .r#enum(self.locatable(chain.span), &member.property.name),
                    ));
                }
                ChainElement::PrivateFieldExpression(member) => {
                    return Some(ConstValueNode::EnumValue(self.gql.r#enum(
                        self.locatable(chain.span),
                        &format!("#{}", member.field.name),
                    )));
                }
                _ => {}
            },
            _ => {}
        }
        self.report_unhandled(
            node.span(),
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
        let mut values: Vec<ConstValueNode> = Vec::new();
        let mut errors = false;
        for element in &node.elements {
            let value = match element.as_expression() {
                Some(element) => self.collect_const_value(element),
                None => {
                    self.report_unhandled(
                        self.array_element_span(element),
                        "constant value",
                        e::default_value_is_not_literal(),
                        None,
                    );
                    None
                }
            };
            match value {
                None => errors = true,
                Some(value) => values.push(value),
            }
        }
        if errors {
            return None;
        }
        Some(self.gql.list(self.locatable(node.span), values))
    }

    fn collect_object_literal(
        &mut self,
        node: &'a ObjectExpression<'a>,
    ) -> Option<ConstObjectValueNode> {
        let mut fields: Vec<ConstObjectFieldNode> = Vec::new();
        let mut errors = false;
        for property in &node.properties {
            let field = self.collect_object_field(property);
            match field {
                None => errors = true,
                Some(field) => fields.push(field),
            }
        }
        if errors {
            return None;
        }
        Some(self.gql.object(self.locatable(node.span), fields))
    }

    fn collect_object_field(
        &mut self,
        node: &'a ObjectPropertyKind<'a>,
    ) -> Option<ConstObjectFieldNode> {
        let property = match node {
            ObjectPropertyKind::ObjectProperty(property)
                if property.kind == PropertyKind::Init
                    && !property.method
                    && !property.shorthand =>
            {
                property
            }
            _ => {
                self.report_unhandled(
                    node.span(),
                    "constant value",
                    e::default_arg_element_is_not_assignment(),
                    None,
                );
                return None;
            }
        };
        let (name_span, name) =
            self.expect_name_identifier(key_name(self.file, &property.key, property.computed))?;

        let value = self.collect_const_value(&property.value)?;
        Some(self.gql.const_object_field(
            self.locatable(property.span),
            self.gql.name(self.locatable(name_span), name),
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
        // Check if enum must be exported when tsClientEnums is configured
        let mut exported: Option<ExportDefinition> = None;
        let export_kind = self.export_kind(node);
        let is_exported = export_kind.is_some();
        if self.config.ts_client_enums.is_some() && !is_exported {
            self.report(
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
        if let Some(is_default) = export_kind {
            exported = Some(ExportDefinition {
                ts_module_path: relative_path(self.grats_root, &self.file.path),
                export_name: if is_default {
                    None
                } else {
                    Some(decl.id.name.to_string())
                },
            });
        }

        let description = self.collect_description(node);
        let values = self.collect_enum_values(decl);
        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::Enum);

        let directives = self.collect_directives(node);

        let definition = self.gql.enum_type_definition(
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
            self.report(
                self.node_span(node),
                e::type_alias_enum_not_supported_with_emit_enums(),
                None,
                None,
            );
            return;
        }

        let Some(values) = self.enum_type_alias_variants(node, decl) else {
            return;
        };

        let description = self.collect_description(node);
        self.record_type_name(node, name.clone(), DeclarationDefinitionKind::Enum);

        let directives = self.collect_directives(node);

        let definition = self.gql.enum_type_definition(
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
            return Some(vec![self.gql.enum_value_definition(
                self.locatable(self.node_span(node)),
                self.gql.name(self.locatable(literal.span), &literal.value),
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

        let mut values: Vec<EnumValueDefinitionNode> = Vec::new();
        for member in &union.types {
            let Some(literal) = string_literal_type(member) else {
                self.report_unhandled(
                    member.span(),
                    "union member",
                    e::enum_variant_not_string_literal(),
                    None,
                );
                continue;
            };
            // PORT: Literal types can't have JSDoc, so aren't in the index.
            let directives = match self.jsdoc.from_ast(member_type_node_id(member)) {
                Some(member) => self.collect_directives(member),
                None => Vec::new(),
            };
            // TODO: Support descriptions on enum members. As it stands, TypeScript
            // does not allow comments attached to string literal types.
            values.push(self.gql.enum_value_definition(
                self.locatable(self.node_span(node)),
                self.gql.name(self.locatable(literal.span), &literal.value),
                Some(directives),
                None,
                None,
            ));
        }

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
        //
        // PORT: An exported declaration is its oxc parent's declaration.
        let nodes = self.file.semantic().nodes();
        let mut statement = decl.node_id();
        if let AstKind::ExportDeclaration(export) = nodes.parent_kind(statement) {
            statement = export.node_id();
        }
        let statement_span = nodes.kind(statement).span();
        let statements: &'a [Statement<'a>] = match nodes.parent_kind(statement) {
            AstKind::Program(program) => &program.body,
            AstKind::BlockStatement(block) => &block.body,
            AstKind::FunctionBody(body) => &body.statements,
            AstKind::TSModuleBlock(block) => &block.body,
            AstKind::SwitchCase(case) => &case.consequent,
            AstKind::StaticBlock(block) => &block.body,
            _ => {
                self.report(
                    indexed_access.span,
                    e::enum_const_must_precede_type_alias(),
                    None,
                    None,
                );
                return None;
            }
        };
        let node_index = statements
            .iter()
            .position(|statement| statement.span() == statement_span);
        let Some(node_index) = node_index.filter(|&index| index > 0) else {
            self.report(
                indexed_access.span,
                e::enum_const_must_precede_type_alias(),
                None,
                None,
            );
            return None;
        };

        let preceding_statement = &statements[node_index - 1];

        // Preceding statement must be a const variable statement
        let variable_statement = match preceding_statement {
            Statement::VariableDeclaration(declaration) => Some(declaration),
            Statement::ExportDeclaration(export) => match &export.declaration {
                Declaration::VariableDeclaration(declaration) => Some(declaration),
                _ => None,
            },
            _ => None,
        };
        let Some(variable_statement) = variable_statement.filter(|declaration| {
            matches!(
                declaration.kind,
                VariableDeclarationKind::Const | VariableDeclarationKind::AwaitUsing
            )
        }) else {
            self.report(
                indexed_access.span,
                e::enum_const_must_precede_type_alias(),
                None,
                None,
            );
            return None;
        };

        let declarations = &variable_statement.declarations;
        if declarations.len() != 1 {
            self.report(
                indexed_access.span,
                e::enum_const_must_precede_type_alias(),
                None,
                None,
            );
            return None;
        }

        let declaration = &declarations[0];
        let BindingPattern::BindingIdentifier(declaration_name) = &declaration.id else {
            self.report(
                indexed_access.span,
                e::enum_const_must_precede_type_alias(),
                None,
                None,
            );
            return None;
        };

        // Validate the name matches
        if declaration_name.name != referenced_name {
            self.report(
                indexed_access.span,
                e::enum_const_name_mismatch(referenced_name, &declaration_name.name),
                None,
                None,
            );
            return None;
        }

        // Extract the `as const` expression, handling both `X as const` and `X as const satisfies T`
        let Some(const_expr) = extract_as_const_expression(declaration) else {
            self.report(
                indexed_access.span,
                e::enum_const_missing_as_const(),
                None,
                None,
            );
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
            self.report(expr.span(), e::enum_const_invalid_expression(), None, None);
            return None;
        };

        let mut values: Vec<EnumValueDefinitionNode> = Vec::new();
        for element in &expr.elements {
            let Some(Expression::StringLiteral(element)) = element.as_expression() else {
                self.report_unhandled(
                    self.array_element_span(element),
                    "union member",
                    e::enum_variant_not_string_literal(),
                    None,
                );
                continue;
            };

            let error_message = graphql_name_validation_message(&element.value);
            if let Some(error_message) = error_message {
                self.report(element.span, error_message, None, None);
            }

            values.push(self.gql.enum_value_definition(
                self.locatable(self.node_span(node)),
                self.gql.name(self.locatable(element.span), &element.value),
                None,
                None,
                None,
            ));
        }

        Some(values)
    }

    fn enum_values_from_object_literal(
        &mut self,
        expr: &'a Expression<'a>,
    ) -> Option<Vec<EnumValueDefinitionNode>> {
        let Expression::ObjectExpression(expr) = expr else {
            self.report(expr.span(), e::enum_const_invalid_expression(), None, None);
            return None;
        };

        let mut values: Vec<EnumValueDefinitionNode> = Vec::new();
        for prop in &expr.properties {
            let assignment = match prop {
                ObjectPropertyKind::ObjectProperty(property)
                    if property.kind == PropertyKind::Init
                        && !property.method
                        && !property.shorthand =>
                {
                    match &property.value {
                        Expression::StringLiteral(value) => Some((property, value)),
                        _ => None,
                    }
                }
                _ => None,
            };
            let Some((prop, value)) = assignment else {
                self.report_unhandled(
                    prop.span(),
                    "enum value",
                    e::enum_variant_not_string_literal(),
                    None,
                );
                continue;
            };

            let error_message = graphql_name_validation_message(&value.value);
            if let Some(error_message) = error_message {
                self.report(value.span, error_message, None, None);
            }

            let description = self.collect_description(self.ts(prop.node_id()));
            let directives = self.collect_directives(self.ts(prop.node_id()));

            let prop_name = key_name(self.file, &prop.key, prop.computed).span();
            values.push(self.gql.enum_value_definition(
                self.locatable(prop.span),
                self.gql.name(self.locatable(value.span), &value.value),
                Some(directives),
                description,
                Some(self.text(prop_name).to_string()),
            ));
        }

        Some(values)
    }

    fn collect_enum_values(
        &mut self,
        node: &'a TSEnumDeclaration<'a>,
    ) -> Vec<EnumValueDefinitionNode> {
        let mut values: Vec<EnumValueDefinitionNode> = Vec::new();

        for member in &node.body.members {
            let Some(Expression::StringLiteral(initializer)) = &member.initializer else {
                self.report_unhandled(
                    member.span,
                    "enum value",
                    e::enum_variant_missing_initializer(),
                    None,
                );
                continue;
            };

            let error_message = graphql_name_validation_message(&initializer.value);
            if let Some(error_message) = error_message {
                self.report(initializer.span, error_message, None, None);
            }

            let description = self.collect_description(self.ts(member.node_id()));
            let directives = self.collect_directives(self.ts(member.node_id()));

            let member_name = match &member.id {
                TSEnumMemberName::Identifier(name) => name.span,
                TSEnumMemberName::String(name) => name.span,
                TSEnumMemberName::ComputedString(name) => bracket_span(self.file, name.span),
                TSEnumMemberName::ComputedTemplateString(name) => {
                    bracket_span(self.file, name.span)
                }
            };
            values.push(
                self.gql.enum_value_definition(
                    self.locatable(member.span),
                    self.gql
                        .name(self.locatable(initializer.span), &initializer.value),
                    Some(directives),
                    description,
                    Some(self.text(member_name).to_string()),
                ),
            );
        }

        values
    }

    /// PORT: `node` is the span of the declaration, and `name` its name, if
    /// it has one.
    fn entity_name(&mut self, node: Span, name: Option<Name<'a>>, tag: TagId) -> Option<NameNode> {
        let jsdoc = self.jsdoc;
        let tag_data = jsdoc.tag(tag);
        if tag_data.comment.is_some() {
            let comment_name = get_text_of_js_doc_comment(tag_data.comment.as_ref());
            if let Some(comment_name) = comment_name {
                // FIXME: Use the _value_'s location not the tag's
                let loc_node = self.tag_span(tag);

                // Test for leading newlines using the raw text
                let has_leading_newlines =
                    trim_trailing_comment_lines(self.text(loc_node)).contains('\n');
                let has_internal_whitespace = comment_name.chars().any(is_js_white_space);
                let validation_message = graphql_name_validation_message(&comment_name);

                if has_leading_newlines && validation_message.is_none() {
                    // TODO: Offer quick fix.
                    self.report(
                        loc_node,
                        e::graphql_name_has_leading_newlines(
                            &comment_name,
                            &tag_data.tag_name.text,
                        ),
                        None,
                        None,
                    );
                    return None;
                }

                if has_leading_newlines || has_internal_whitespace {
                    self.report(
                        loc_node,
                        e::graphql_tag_name_has_whitespace(&tag_data.tag_name.text),
                        None,
                        None,
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
                    self.report(loc_node, validation_message, None, None);
                    return None;
                }
                return Some(self.gql.name(self.locatable(loc_node), &comment_name));
            }
        }

        let Some(name) = name else {
            self.report(node, e::gql_entity_missing_name(), None, None);
            return None;
        };
        let (id_span, id) = self.expect_name_identifier(name)?;
        Some(self.gql.name(self.locatable(id_span), id))
    }

    fn method_declaration(&mut self, node: MethodLike<'a>) -> Option<FieldDefinitionNode> {
        let tag = self.find_tag(self.ts(node.id), FIELD_TAG)?;

        let name_node = key_name(self.file, node.key, node.computed);
        for (modifier, modifier_span) in
            self.modifiers(node.modifiers_start, name_node.span().start)
        {
            match modifier {
                "private" | "protected" => {
                    self.report(
                        modifier_span,
                        e::invalid_field_non_public_access_modifier(),
                        None,
                        None,
                    );
                }
                "static" => {
                    // Return early here, since static methods expect a parent object as
                    // first argument rather than args, and we don't want to emit
                    // confusing error messages
                    // Note: We expect that static methods are handled at the top-level
                    // and will be filtered out before getting here, so this just
                    // catches static property signatures which are also invalid
                    // TypeScript.
                    self.report(modifier_span, e::invalid_static_modifier(), None, None);
                    return None;
                }
                _ => {}
            }
        }

        let name = self.entity_name(node.span, Some(name_node), tag)?;

        let Some(node_type) = node.return_type else {
            self.report(name_node.span(), e::method_missing_type(), None, None);
            return None;
        };

        let r#type = self.collect_type(&node_type.type_annotation, FieldTypeContext::Output)?;

        let (resolver_params, args) = self.resolver_params(&node.params)?;

        let description = self.collect_description(self.ts(node.id));

        let (_, id) = self.expect_name_identifier(name_node)?;
        let directives = self.collect_directives(self.ts(node.id));

        let kills_parent_on_exception = self.kills_parent_on_exception(self.ts(node.id));

        let resolver_name = if id == name.value {
            None
        } else {
            Some(id.to_string())
        };
        Some(self.gql.field_definition(
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
                    None,
                    None,
                );
                return None;
            }
            let Some(param_type) = param.type_annotation() else {
                self.report(
                    param.span(),
                    e::resolver_param_is_missing_type(),
                    None,
                    None,
                );
                return None;
            };
            if let TSType::TSTypeLiteral(literal) = &param_type.type_annotation {
                if let Some((previous, _)) = &args {
                    let related = ts_related(
                        self.locatable(previous.span()),
                        "Previous type literal".to_string(),
                    );
                    self.report(
                        param.span(),
                        e::multiple_resolver_type_literals(),
                        Some(vec![related]),
                        None,
                    );
                    return None;
                }
                resolver_params.push(ResolverArgument::ArgumentsObject {
                    loc: Some(loc(self.locatable(param.span()))),
                });
                let mut inputs: Vec<InputValueDefinitionNode> = Vec::new();

                let mut defaults: Option<ArgDefaults<'a>> = None;
                if let Param::Item(item) = param
                    && let BindingPattern::ObjectPattern(pattern) = &item.pattern
                {
                    defaults = Some(self.collect_arg_defaults(pattern));
                }

                for member in &literal.members {
                    let arg = self.collect_arg(member, defaults.as_ref());
                    if let Some(arg) = arg {
                        inputs.push(arg);
                    }
                }
                args = Some((param, inputs));
                continue;
            }

            let input_definition = self.collect_param_arg(param, param_type)?;
            resolver_params.push(ResolverArgument::Unresolved {
                input_definition,
                loc: Some(loc(self.locatable(param.span()))),
            });
        }
        Some((resolver_params, args.map(|(_, inputs)| inputs)))
    }

    /// PORT: Takes the parameter's type annotation, which TypeScript asserts
    /// is present.
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
                value: self.gql.name(self.locatable(span), text),
            },
            Name::Other(span) => self.diagnostic_handle(ts_err(
                self.locatable(span),
                e::positional_resolver_arg_does_not_have_name(),
                None,
                None,
            )),
        };

        let r#type = self.collect_type(&param_type.type_annotation, FieldTypeContext::Input)?;

        let mut default_value: Option<ConstValueNode> = None;

        if let Some(initializer) = param.initializer() {
            default_value = self.collect_const_value(initializer);
        }

        if param.optional() {
            // Question mark means we can handle the argument being undefined in the
            // object literal, but if we are going to type the GraphQL arg as
            // optional, the code must also be able to handle an explicit null.
            //
            // In the object map args case we have to consider the possibility of a
            // default value, but TS does not allow default value for optional args,
            // so TS will take care of that for us.
            if matches!(r#type, TypeNode::NonNullType(_)) {
                // This is only a problem if the type turns out to be a GraphQL type.
                // If it's info or context, it's fine. So, we defer the error until
                // later when we try to use this as a GraphQL type.
                if let DiagnosticHandleResult::Ok { .. } = name {
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
            }
        }

        let directives = self.collect_directives(self.ts(param.node_id()));

        let description = self.collect_description(self.ts(param.node_id()));
        Some(self.gql.input_value_definition_or_resolver_arg(
            self.locatable(param.span()),
            name,
            r#type,
            Some(directives),
            default_value,
            description,
        ))
    }

    /// PORT: Records a diagnostic which a `DiagnosticHandle` refers to.
    fn diagnostic_handle<T>(&mut self, diagnostic: Diagnostic) -> DiagnosticHandleResult<T> {
        let handle = DiagnosticHandle { id: unique_id() };
        self.diagnostics_by_handle.insert(handle, diagnostic);
        DiagnosticHandleResult::Error { err: handle }
    }

    fn collect_description(&mut self, node: TsNodeId) -> Option<StringValueNode> {
        let jsdoc = self.jsdoc;
        let docs = jsdoc.get_js_doc_comments_and_tags(node);

        let comment = docs
            .into_iter()
            .filter_map(|doc| match doc {
                JSDocOrTag::JSDoc(doc) => Some(doc),
                JSDocOrTag::Tag(_) => None,
            })
            .map(|doc| match &jsdoc.js_doc(doc).comment {
                Some(comment) => template_string(Some(comment)),
                None => String::new(),
            })
            .collect::<Vec<_>>()
            .join("");

        if !comment.is_empty() {
            return Some(self.gql.string(
                self.locatable(self.node_span(node)),
                js_trim(&comment),
                Some(true),
            ));
        }
        None
    }

    fn property(&mut self, node: PropertyLike<'a>) -> Option<FieldDefinitionNode> {
        let tag = self.find_tag(self.ts(node.id), FIELD_TAG)?;

        let node_name = key_name(self.file, node.key, node.computed);
        let name = self.entity_name(node.span, Some(node_name), tag)?;

        let Some(node_type) = node.type_annotation else {
            self.report(
                node_name.span(),
                e::property_field_missing_type(),
                None,
                None,
            );
            return None;
        };

        let inner = self.collect_type(&node_type.type_annotation, FieldTypeContext::Output)?;
        // We already reported an error
        let r#type = if !node.optional {
            inner
        } else {
            self.gql.nullable_type(inner).into()
        };

        let description = self.collect_description(self.ts(node.id));

        let (_, id) = self.expect_name_identifier(node_name)?;

        let directives = self.collect_directives(self.ts(node.id));

        let kills_parent_on_exception = self.kills_parent_on_exception(self.ts(node.id));

        Some(self.gql.field_definition(
            self.locatable(node.span),
            name.clone(),
            r#type,
            None,
            directives,
            description,
            kills_parent_on_exception,
            ResolverSignature::Property {
                name: if id == name.value {
                    None
                } else {
                    Some(id.to_string())
                },
            },
        ))
    }

    // TODO: Support separate modes for input and output types
    // For input nodes and field may only be optional if `null` is a valid value.
    fn collect_type(&mut self, node: &'a TSType<'a>, ctx: FieldTypeContext) -> Option<TypeNode> {
        match node {
            TSType::TSTypeReference(reference) => {
                let r#type = self.type_reference(node, reference, ctx)?;
                return Some(r#type);
            }
            TSType::TSArrayType(array) => {
                let element = self.collect_type(&array.element_type, ctx)?;
                return Some(self.gql.non_null_type(
                    self.locatable(array.span),
                    TypeNode::ListType(self.gql.list_type(self.locatable(array.span), element)),
                ));
            }
            TSType::TSUnionType(union) => {
                let types: Vec<&'a TSType<'a>> = union
                    .types
                    .iter()
                    .filter(|r#type| !is_nullish(r#type))
                    .collect();
                if types.is_empty() {
                    self.report(union.span, e::expected_one_non_nullish_type(), None, None);
                    return None;
                }

                let r#type = self.collect_type(types[0], ctx)?;

                if types.len() > 1 {
                    let first = types[0];
                    // FIXME: If each of `rest` matches `first` this should be okay.
                    let incompatible_variants = types[1..]
                        .iter()
                        .map(|ts_type| {
                            ts_related(
                                self.locatable(ts_type.span()),
                                "Other non-nullish type".to_string(),
                            )
                        })
                        .collect();
                    self.report(
                        first.span(),
                        e::expected_one_non_nullish_type(),
                        Some(incompatible_variants),
                        None,
                    );
                    return None;
                }
                if union.types.len() > 1 {
                    return Some(self.gql.with_location(
                        self.locatable(union.span),
                        self.gql.nullable_type(r#type),
                    ));
                }
                return Some(self.gql.non_null_type(self.locatable(union.span), r#type));
            }
            TSType::TSParenthesizedType(parenthesized) => {
                return self.collect_type(&parenthesized.type_annotation, ctx);
            }
            TSType::TSStringKeyword(keyword) => {
                return Some(self.gql.non_null_type(
                    self.locatable(keyword.span),
                    TypeNode::NamedType(
                        self.gql.named_type(self.locatable(keyword.span), "String"),
                    ),
                ));
            }
            TSType::TSBooleanKeyword(keyword) => {
                return Some(self.gql.non_null_type(
                    self.locatable(keyword.span),
                    TypeNode::NamedType(
                        self.gql.named_type(self.locatable(keyword.span), "Boolean"),
                    ),
                ));
            }
            TSType::TSNumberKeyword(keyword) => {
                self.report(keyword.span, e::ambiguous_number_type(), None, None);
                return None;
            }
            // PORT: TypeScript's literal types include `null` and template
            // literals without substitutions.
            TSType::TSLiteralType(_) | TSType::TSNullKeyword(_) => {
                // Literal types are only valid in output positions. In input positions,
                // GraphQL cannot enforce that only this specific value is passed.
                if ctx == FieldTypeContext::Input {
                    self.report(node.span(), e::literal_type_in_input_position(), None, None);
                    return None;
                }
                if let TSType::TSLiteralType(literal) = node {
                    match &literal.literal {
                        TSLiteral::BooleanLiteral(_) => {
                            return Some(self.gql.non_null_type(
                                self.locatable(literal.span),
                                TypeNode::NamedType(
                                    self.gql.named_type(self.locatable(literal.span), "Boolean"),
                                ),
                            ));
                        }
                        TSLiteral::StringLiteral(_) => {
                            return Some(self.gql.non_null_type(
                                self.locatable(literal.span),
                                TypeNode::NamedType(
                                    self.gql.named_type(self.locatable(literal.span), "String"),
                                ),
                            ));
                        }
                        TSLiteral::NumericLiteral(_) => {
                            self.report(
                                literal.span,
                                e::ambiguous_number_literal_type(),
                                None,
                                None,
                            );
                            return None;
                        }
                        _ => {}
                    }
                }
            }
            TSType::TSTemplateLiteralType(template) if template.types.is_empty() => {
                if ctx == FieldTypeContext::Input {
                    self.report(
                        template.span,
                        e::literal_type_in_input_position(),
                        None,
                        None,
                    );
                    return None;
                }
            }
            TSType::TSTypeLiteral(literal) => {
                self.report(literal.span, e::unsupported_type_literal(), None, None);
                return None;
            }
            TSType::TSTypeOperatorType(operator)
                if operator.operator == TSTypeOperatorOperator::Readonly =>
            {
                return self.collect_type(&operator.type_annotation, ctx);
            }
            _ => {}
        }
        // TODO: Better error message. This is okay if it's a type reference, but everything else is not.
        self.report_unhandled(node.span(), "type", e::unknown_graphql_type(), None);
        None
    }

    /// Unwraps a Promise<T> type to T, tracking whether it was async.
    /// Returns null if there's an error (e.g., Promise without type arguments).
    fn maybe_unwrap_promise_type(&mut self, r#type: &'a TSType<'a>) -> Option<UnwrappedType<'a>> {
        let TSType::TSTypeReference(reference) = r#type else {
            return Some(UnwrappedType {
                r#type,
                is_async: false,
            });
        };

        if let TSTypeName::IdentifierReference(type_name) = &reference.type_name
            && type_name.name == "Promise"
        {
            match &reference.type_arguments {
                Some(type_arguments) if type_arguments.params.len() == 1 => {
                    return Some(UnwrappedType {
                        r#type: &type_arguments.params[0],
                        is_async: true,
                    });
                }
                _ => {
                    self.report(
                        reference.span,
                        e::wrapper_missing_type_arg(&type_name.name),
                        None,
                        None,
                    );
                    return None;
                }
            }
        }

        Some(UnwrappedType {
            r#type,
            is_async: false,
        })
    }

    /// PORT: Takes the type reference both as a type and as a reference.
    fn type_reference(
        &mut self,
        type_node: &'a TSType<'a>,
        node: &'a TSTypeReference<'a>,
        ctx: FieldTypeContext,
    ) -> Option<TypeNode> {
        let (_, type_name) = self.expect_name_identifier(type_name(&node.type_name))?;

        // Some types are not valid as input types. Validate that here:
        if ctx == FieldTypeContext::Input {
            match type_name {
                "AsyncIterable" => {
                    self.report(
                        node.span,
                        "`AsyncIterable` is not a valid as an input type.".to_string(),
                        None,
                        None,
                    );
                    return None;
                }
                "Promise" => {
                    self.report(
                        node.span,
                        "`Promise` is not a valid as an input type.".to_string(),
                        None,
                        None,
                    );
                    return None;
                }
                _ => {}
            }
        }
        match type_name {
            "Array" | "Iterator" | "ReadonlyArray" | "AsyncIterable" => {
                let Some(type_arguments) = &node.type_arguments else {
                    self.report(node.span, e::plural_type_missing_parameter(), None, None);
                    return None;
                };
                let element = self.collect_type(type_arguments.params.first()?, ctx)?;
                let mut list_type = self.gql.list_type(self.locatable(node.span), element);
                if type_name == "AsyncIterable" {
                    list_type.is_async_iterable = true;
                }
                Some(
                    self.gql
                        .non_null_type(self.locatable(node.span), TypeNode::ListType(list_type)),
                )
            }
            "Promise" => {
                let unwrapped = self.maybe_unwrap_promise_type(type_node)?;
                let element = self.collect_type(unwrapped.r#type, ctx)?;
                Some(element)
            }
            _ => {
                // We may not have encountered the definition of this type yet. So, we
                // mark it as unresolved and return a placeholder type.
                //
                // A later pass will resolve the type.
                let named_type = self
                    .gql
                    .named_type(self.locatable(node.span), UNRESOLVED_REFERENCE_NAME);
                self.mark_unresolved_type(EntityName::TypeReference(node), &named_type.name);
                Some(
                    self.gql
                        .non_null_type(self.locatable(node.span), TypeNode::NamedType(named_type)),
                )
            }
        }
    }

    fn expect_name_identifier(&mut self, node: Name<'a>) -> Option<(Span, &'a str)> {
        match node {
            Name::Identifier(span, text) => Some((span, text)),
            Name::Other(span) => {
                self.report(span, e::expected_name_identifier(), None, None);
                None
            }
        }
    }

    // It is a GraphQL best practice to model all fields as nullable. This allows
    // the server to handle field level executions by simply returning null for
    // that field.
    // https://graphql.org/learn/best-practices/#nullability
    fn kills_parent_on_exception(&self, parent_node: TsNodeId) -> Option<NameNode> {
        let tags = self.jsdoc.get_js_doc_tags(parent_node);
        let kills_parent_on_exceptions = tags
            .into_iter()
            .find(|&tag| self.jsdoc.tag(tag).tag_name.text == KILLS_PARENT_ON_EXCEPTION_TAG);
        kills_parent_on_exceptions.map(|tag| {
            self.gql.name(
                self.locatable(self.tag_name_span(tag)),
                KILLS_PARENT_ON_EXCEPTION_TAG,
            )
        })
    }

    /* PORT: Helpers for reading oxc's AST as TypeScript's. */

    /// PORT: The oxc node a JSDoc index node was built from.
    fn kind(&self, node: TsNodeId) -> Option<AstKind<'a>> {
        let id = self.jsdoc.node(node).ast?;
        Some(self.file.semantic().nodes().kind(id))
    }

    fn ast(&self, node: TsNodeId) -> AstKind<'a> {
        self.kind(node).expect("Expected an oxc node")
    }

    /// PORT: The JSDoc index node of an oxc node.
    fn ts(&self, id: NodeId) -> TsNodeId {
        self.jsdoc
            .from_ast(id)
            .expect("Expected the node to be in the JSDoc index")
    }

    /// PORT: The span of a node, as TypeScript's `getStart()` and `getEnd()`
    /// give it: including any `export` and decorators.
    fn node_span(&self, node: TsNodeId) -> Span {
        let node = self.jsdoc.node(node);
        Span::new(node.start, node.end)
    }

    fn text(&self, span: Span) -> &'a str {
        &self.file.text[span.start as usize..span.end as usize]
    }

    /// PORT: Whether the declaration is exported, and if so, whether it's the
    /// default export. TypeScript reads its modifiers.
    fn export_kind(&self, node: TsNodeId) -> Option<bool> {
        let id = self.jsdoc.node(node).ast?;
        match self.file.semantic().nodes().parent_kind(id) {
            AstKind::ExportDeclaration(_) => Some(false),
            AstKind::ExportDefaultDeclaration(_) => Some(true),
            _ => None,
        }
    }

    /// PORT: TypeScript's modifier keywords between `from` and `to`, which oxc
    /// records as flags (if at all), without their spans.
    fn modifiers(&self, from: u32, to: u32) -> Vec<(&'a str, Span)> {
        let text = self.file.text;
        let comments = self.file.semantic().comments();
        let mut modifiers = Vec::new();
        let mut pos = skip_trivia(text, from, comments);
        while pos < to {
            let rest = &text[pos as usize..];
            let word_len = rest
                .find(|ch: char| !(ch.is_ascii_alphanumeric() || ch == '_' || ch == '$'))
                .unwrap_or(rest.len());
            if word_len == 0 {
                pos += rest.chars().next().map_or(1, |ch| ch.len_utf8() as u32);
            } else {
                let word = &rest[..word_len];
                if MODIFIERS.contains(&word) {
                    modifiers.push((word, Span::new(pos, pos + word_len as u32)));
                }
                pos += word_len as u32;
            }
            pos = skip_trivia(text, pos, comments);
        }
        modifiers
    }

    /// PORT: `ts.isSourceFile(node.parent)`.
    fn is_top_level(&self, node: TsNodeId) -> bool {
        self.jsdoc
            .node(node)
            .parent
            .is_some_and(|parent| self.jsdoc.node(parent).kind == SyntaxKind::SourceFile)
    }

    /// PORT: A `VariableStatement`'s `declarationList`, which oxc doesn't
    /// have.
    fn declaration_list(&self, statement: TsNodeId) -> TsNodeId {
        self.jsdoc
            .node(statement)
            .children
            .iter()
            .copied()
            .find(|&child| self.jsdoc.node(child).kind == SyntaxKind::VariableDeclarationList)
            .expect("Expected a variable statement to have a declaration list")
    }

    /// PORT: The span of the `?` after `after`.
    fn question_token(&self, after: u32) -> Span {
        let pos = skip_trivia(self.file.text, after, self.file.semantic().comments());
        Span::new(pos, pos + 1)
    }

    /// PORT: The span of an element of an array literal. An elision is
    /// TypeScript's `OmittedExpression`, which is empty, so its start is its
    /// full start: the end of the token before it.
    fn array_element_span(&self, element: &ArrayExpressionElement<'a>) -> Span {
        match element {
            ArrayExpressionElement::Elision(elision) => {
                let start = full_start_of(self.file, elision.span.start);
                Span::new(start, start)
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
            // PORT: oxc doesn't record whether an `accessor` is optional.
            Member::Class(ClassElement::AccessorProperty(property)) => {
                let name = key_name(self.file, &property.key, property.computed);
                let question = self.question_token(name.span().end);
                Some(PropertyLike {
                    span: property.span,
                    id: property.node_id(),
                    key: &property.key,
                    computed: property.computed,
                    type_annotation: property.type_annotation.as_deref(),
                    optional: self.text(question) == "?",
                })
            }
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

    /// PORT: `member.name`, for the members which have one.
    fn member_name(&self, member: Member<'a>) -> Option<Name<'a>> {
        match member {
            Member::Class(ClassElement::MethodDefinition(method)) => {
                if method.kind == MethodDefinitionKind::Constructor {
                    return None;
                }
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

/// PORT: The modifier keywords TypeScript parses.
const MODIFIERS: [&str; 15] = [
    "abstract",
    "accessor",
    "async",
    "const",
    "declare",
    "default",
    "export",
    "in",
    "out",
    "override",
    "private",
    "protected",
    "public",
    "readonly",
    "static",
];

type ArgDefaults<'a> = HashMap<&'a str, &'a Expression<'a>>;

#[derive(Clone, Copy, PartialEq)]
enum FieldTypeContext {
    Input,
    Output,
}

/// PORT: `{ type, isAsync }`.
struct UnwrappedType<'a> {
    r#type: &'a TSType<'a>,
    is_async: bool,
}

/// PORT: A TypeScript `PropertyName`, `BindingName` or `EntityName`: an
/// identifier, or another kind of name, which is reported.
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

/// PORT: A `ts.ClassElement` or `ts.TypeElement`.
#[derive(Clone, Copy)]
enum Member<'a> {
    Class(&'a ClassElement<'a>),
    Type(&'a TSSignature<'a>),
}

/// PORT: The declaration whose heritage clauses are read.
#[derive(Clone, Copy)]
enum Heritage<'a> {
    Class(&'a Class<'a>),
    Interface(&'a TSInterfaceDeclaration<'a>),
    TypeAlias,
}

/// PORT: A `ts.ParameterDeclaration`. TypeScript's parameters include `this`
/// and rest parameters.
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

    /// PORT: Where the modifiers start: after any decorators.
    fn modifiers_start(self) -> u32 {
        self.decorators()
            .last()
            .map_or(self.span().start, |decorator| decorator.span.end)
    }

    /// PORT: Where the modifiers end: at the `...` or the name.
    fn modifiers_end(self) -> u32 {
        match self {
            Param::Rest(param) => param.rest.span.start,
            _ => self.name().span().start,
        }
    }
}

/// PORT: A `ts.MethodDeclaration`, `ts.MethodSignature` or
/// `ts.GetAccessorDeclaration`.
struct MethodLike<'a> {
    span: Span,
    id: NodeId,
    /// PORT: Where the modifiers start: after any decorators.
    modifiers_start: u32,
    key: &'a PropertyKey<'a>,
    computed: bool,
    /// Whether it's a method, rather than a get accessor.
    callable: bool,
    params: Vec<Param<'a>>,
    return_type: Option<&'a TSTypeAnnotation<'a>>,
}

/// PORT: A `ts.FunctionDeclaration`, `ts.MethodDeclaration` or
/// `ts.ArrowFunction`.
struct FunctionLike<'a> {
    id: TsNodeId,
    params: Vec<Param<'a>>,
    return_type: Option<&'a TSTypeAnnotation<'a>>,
}

/// PORT: `{ resolverParams, args, typeName }`.
struct AbstractFieldArgs {
    resolver_params: Vec<ResolverArgument>,
    args: Option<Vec<InputValueDefinitionNode>>,
    type_name: NameNode,
}

/// PORT: A `ts.PropertyDeclaration` or `ts.PropertySignature`.
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

/// PORT: A function's parameters, as TypeScript lists them.
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

/// PORT: A property's name. A computed name is TypeScript's
/// `ComputedPropertyName`, which includes the brackets.
fn key_name<'a>(file: &ParsedFile, key: &PropertyKey<'a>, computed: bool) -> Name<'a> {
    if computed {
        return Name::Other(bracket_span(file, key.span()));
    }
    match key {
        PropertyKey::StaticIdentifier(id) => Name::Identifier(id.span, id.name.as_str()),
        _ => Name::Other(key.span()),
    }
}

/// PORT: The span of a computed name's brackets, around `expression`.
fn bracket_span(file: &ParsedFile, expression: Span) -> Span {
    let start = full_start_of(file, expression.start) - 1;
    let end = skip_trivia(file.text, expression.end, file.semantic().comments()) + 1;
    Span::new(start, end)
}

fn full_start_of(file: &ParsedFile, start: u32) -> u32 {
    let hashbang_end = file
        .program
        .hashbang
        .as_ref()
        .map(|hashbang| hashbang.span.end);
    full_start(file.text, start, file.semantic().comments(), hashbang_end)
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

/// PORT: `X` of `typeof X`, if `X` is an identifier.
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
/// `as const` or `as const satisfies T` assertion. Returns null if the
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

fn graphql_name_validation_message(name: &str) -> Option<String> {
    assert_name(name).err().map(|error| error.message)
}

// Trims any number of whitespace-only lines including any lines that simply
// contain a `*` surrounded by whitespace.
//
// PORT: `text.replace(/(\s*\n\s*\*?\s*)+$/, "")`.
fn trim_trailing_comment_lines(text: &str) -> &str {
    for (index, _) in text.char_indices() {
        if is_trailing_comment_lines(&text[index..]) {
            return &text[..index];
        }
    }
    text
}

/// Whether all of `text` matches `(\s*\n\s*\*?\s*)+`.
fn is_trailing_comment_lines(text: &str) -> bool {
    let mut seen_newline = false;
    let mut seen_star = false;
    for ch in text.chars() {
        if ch == '\n' {
            seen_newline = true;
            seen_star = false;
        } else if ch == '*' {
            if !seen_newline || seen_star {
                return false;
            }
            seen_star = true;
        } else if !is_js_white_space(ch) {
            return false;
        }
    }
    seen_newline
}

/// PORT: How a JSDoc tag's comment is interpolated into a JavaScript template
/// string. A list of comment parts becomes their objects' strings, joined.
fn template_string(comment: Option<&JSDocComment>) -> String {
    match comment {
        Some(JSDocComment::Text(text)) => text.clone(),
        Some(JSDocComment::Parts(parts)) => vec!["[object Object]"; parts.len()].join(","),
        None => "undefined".to_string(),
    }
}
