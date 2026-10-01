//! The JSDoc comments attached to each node, as TypeScript's parser attaches
//! them (`addJSDocComment`), and what TypeScript's rules for finding a
//! node's JSDoc need to know about the node: its kind, location and parent.
//!
//! PORT: No TypeScript counterpart. The nodes are built from oxc's, with the
//! differences between the two ASTs smoothed over (see `JSDocIndex::new`).
//! Their kinds are TypeScript's, only so that its rules apply as written.
//! Offsets are UTF-8 byte offsets.

use oxc_ast::AstKind;
use oxc_ast::ast::{
    BindingPattern, ClassType, ExportDefaultDeclarationKind, Expression, FunctionType,
    MethodDefinitionKind, PropertyKind, TSMethodSignatureKind,
};
use oxc_semantic::{NodeId, Semantic};
use oxc_span::{GetSpan, Span};

use super::parser::{JSDoc, parse_jsdoc_comment};
use super::scanner::is_white_space_like;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct TsNodeId(u32);

/// A JSDoc comment attached to a node.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct JSDocId(u32);

/// A tag of a JSDoc comment, by its index in the comment's tags. Like the
/// tags objects of TypeScript, two are only equal if they're the same tag of
/// the same attached comment.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct TagId {
    pub js_doc: JSDocId,
    pub index: u32,
}

/// PORT: TypeScript's `SyntaxKind`, with only the kinds of nodes. Nodes whose
/// kind Grats never checks are `Other`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SyntaxKind {
    EndOfFileToken,
    Identifier,
    PrivateIdentifier,
    ComputedPropertyName,
    TypeParameter,
    Parameter,
    Decorator,
    PropertySignature,
    PropertyDeclaration,
    MethodSignature,
    MethodDeclaration,
    ClassStaticBlockDeclaration,
    Constructor,
    GetAccessor,
    SetAccessor,
    CallSignature,
    ConstructSignature,
    IndexSignature,
    FunctionType,
    ConstructorType,
    TypeLiteral,
    NamedTupleMember,
    BindingElement,
    ObjectLiteralExpression,
    PropertyAccessExpression,
    ElementAccessExpression,
    ParenthesizedExpression,
    FunctionExpression,
    ArrowFunction,
    BinaryExpression,
    ClassExpression,
    SpreadElement,
    Block,
    EmptyStatement,
    VariableStatement,
    ExpressionStatement,
    IfStatement,
    DoStatement,
    WhileStatement,
    ForStatement,
    ForInStatement,
    ForOfStatement,
    ContinueStatement,
    BreakStatement,
    ReturnStatement,
    WithStatement,
    SwitchStatement,
    LabeledStatement,
    ThrowStatement,
    TryStatement,
    DebuggerStatement,
    VariableDeclaration,
    VariableDeclarationList,
    FunctionDeclaration,
    ClassDeclaration,
    InterfaceDeclaration,
    TypeAliasDeclaration,
    EnumDeclaration,
    ModuleDeclaration,
    ModuleBlock,
    NamespaceExportDeclaration,
    ImportEqualsDeclaration,
    ImportDeclaration,
    ExportAssignment,
    ExportDeclaration,
    ExportSpecifier,
    CaseClause,
    DefaultClause,
    CatchClause,
    PropertyAssignment,
    ShorthandPropertyAssignment,
    SpreadAssignment,
    EnumMember,
    SourceFile,
    Other,
}

#[derive(Debug)]
pub struct TsNode {
    pub kind: SyntaxKind,
    /// The full start, including leading trivia.
    pub pos: u32,
    /// PORT: `getStart()`.
    pub start: u32,
    pub end: u32,
    pub parent: Option<TsNodeId>,
    pub children: Vec<TsNodeId>,
    /// The oxc node this node was built from, if any.
    pub ast: Option<NodeId>,
    pub js_doc: Vec<JSDocId>,
    /// PORT: The `initializer` of variable-like nodes.
    pub initializer: Option<TsNodeId>,
    /// Whether it's an assignment `BinaryExpression`.
    pub is_assignment: bool,
}

pub struct JSDocIndex {
    nodes: Vec<TsNode>,
    js_docs: Vec<JSDoc>,
    by_ast: NodeMap<TsNodeId>,
}

/// A value for some of a file's oxc nodes, by their `NodeId`, which number
/// the nodes from 0.
struct NodeMap<T>(Vec<Option<T>>);

impl<T: Copy> NodeMap<T> {
    fn new(len: usize) -> Self {
        NodeMap(vec![None; len])
    }

    fn get(&self, id: NodeId) -> Option<T> {
        self.0.get(id.index()).copied().flatten()
    }

    fn insert(&mut self, id: NodeId, value: T) {
        self.0[id.index()] = Some(value);
    }
}

/// How an oxc node appears in TypeScript's AST.
enum Mapping {
    /// TypeScript has no such node. Its children are the children of its
    /// parent.
    Skip,
    Node(SyntaxKind),
    /// A `VariableStatement` and its `VariableDeclarationList`.
    VariableStatement,
}

impl JSDocIndex {
    pub fn new(text: &str, semantic: &Semantic) -> Self {
        let nodes = semantic.nodes();
        let mut file = JSDocIndex {
            nodes: Vec::new(),
            js_docs: Vec::new(),
            by_ast: NodeMap::new(nodes.len()),
        };
        // The node the children of each oxc node are children of.
        let mut child_parents: NodeMap<TsNodeId> = NodeMap::new(nodes.len());
        // For oxc nodes without a TypeScript node, the node which stands in
        // for them as an initializer.
        let mut skipped: NodeMap<TsNodeId> = NodeMap::new(nodes.len());
        for node in nodes.iter() {
            let id = node.id();
            let kind = node.kind();
            let oxc_parent = Some(nodes.parent_id(id)).filter(|&parent| parent != id);
            let parent_kind = oxc_parent.map(|parent| nodes.kind(parent));
            let parent = oxc_parent.and_then(|parent| child_parents.get(parent));
            let span = kind.span();
            // PORT: oxc's spans of exported declarations start after the
            // `export`, and those of classes after decorators which come
            // before the `export`.
            let mut start = span.start;
            if let Some(AstKind::ExportDeclaration(_) | AstKind::ExportDefaultDeclaration(_)) =
                parent_kind
            {
                start = start.min(parent_kind.unwrap().span().start);
            }
            if let AstKind::Class(class) = kind
                && let Some(decorator) = class.decorators.first()
            {
                start = start.min(decorator.span.start);
            }
            // PORT: oxc has no node for a computed property name, only a
            // flag on its owner. The span is the expression's, without the
            // brackets.
            let parent = match parent_kind {
                Some(owner) if is_computed_key(owner, span) => {
                    let computed = file.push(
                        SyntaxKind::ComputedPropertyName,
                        span.start,
                        span.end,
                        parent,
                        None,
                    );
                    Some(computed)
                }
                _ => parent,
            };
            match Self::mapping(kind, parent_kind) {
                Mapping::Skip => {
                    if let Some(parent) = parent {
                        child_parents.insert(id, parent);
                    }
                    skipped.insert(id, TsNodeId(file.nodes.len() as u32));
                }
                Mapping::Node(ts_kind) => {
                    // PORT: TypeScript has a `VariableDeclarationList` in
                    // for-heads, but no `VariableStatement`.
                    let (ts_kind, end) = match kind {
                        AstKind::VariableDeclaration(declaration) => (
                            ts_kind,
                            declaration
                                .declarations
                                .last()
                                .map_or(span.end, |declarator| declarator.span.end),
                        ),
                        _ => (ts_kind, span.end),
                    };
                    let ts_id = file.push(ts_kind, start, end, parent, Some(id));
                    file.nodes[ts_id.0 as usize].is_assignment =
                        matches!(kind, AstKind::AssignmentExpression(_));
                    file.by_ast.insert(id, ts_id);
                    child_parents.insert(id, ts_id);
                }
                Mapping::VariableStatement => {
                    let AstKind::VariableDeclaration(declaration) = kind else {
                        unreachable!()
                    };
                    let statement = file.push(
                        SyntaxKind::VariableStatement,
                        start,
                        span.end,
                        parent,
                        Some(id),
                    );
                    // The declaration list starts at its keyword, after any
                    // modifiers.
                    let list_start = if declaration.declare {
                        skip_trivia(
                            text,
                            span.start + "declare".len() as u32,
                            semantic.comments(),
                        )
                    } else {
                        span.start
                    };
                    let list_end = declaration
                        .declarations
                        .last()
                        .map_or(span.end, |declarator| declarator.span.end);
                    let list = file.push(
                        SyntaxKind::VariableDeclarationList,
                        list_start,
                        list_end,
                        Some(statement),
                        None,
                    );
                    file.by_ast.insert(id, statement);
                    child_parents.insert(id, list);
                }
            }
        }
        let text_len = text.len() as u32;
        let source_file = TsNodeId(0);
        let end_of_file = file.push(
            SyntaxKind::EndOfFileToken,
            text_len,
            text_len,
            Some(source_file),
            None,
        );

        // `pos`: The end of the previous token.
        let hashbang_end = semantic
            .nodes()
            .program()
            .hashbang
            .as_ref()
            .map(|hashbang| hashbang.span.end);
        let comments = semantic.comments();
        for node in &mut file.nodes {
            node.pos = full_start(text, node.start, comments, hashbang_end);
        }
        file.nodes[source_file.0 as usize].pos = 0;
        file.nodes[end_of_file.0 as usize].pos = full_start(text, text_len, comments, hashbang_end);

        // Initializers.
        let resolve =
            |file: &JSDocIndex, id: NodeId| file.by_ast.get(id).or_else(|| skipped.get(id));
        for node in nodes.iter() {
            let Some(ts_id) = file.by_ast.get(node.id()) else {
                continue;
            };
            let initializer: Option<&Expression> = match node.kind() {
                AstKind::VariableDeclarator(declarator) => declarator.init.as_ref(),
                AstKind::PropertyDefinition(property) => property.value.as_ref(),
                AstKind::AccessorProperty(property) => property.value.as_ref(),
                AstKind::ObjectProperty(property)
                    if file.nodes[ts_id.0 as usize].kind == SyntaxKind::PropertyAssignment =>
                {
                    Some(&property.value)
                }
                AstKind::FormalParameter(parameter) => parameter.initializer.as_deref(),
                AstKind::TSEnumMember(member) => member.initializer.as_ref(),
                AstKind::BindingProperty(property) => match &property.value {
                    BindingPattern::AssignmentPattern(pattern) => Some(&pattern.right),
                    _ => None,
                },
                _ => None,
            };
            if let Some(initializer) = initializer {
                file.nodes[ts_id.0 as usize].initializer = resolve(&file, initializer.node_id());
            }
        }

        // JSDoc comments.
        for index in 0..file.nodes.len() {
            if !file.has_js_doc_kind(TsNodeId(index as u32), text) {
                continue;
            }
            for range in get_js_doc_comment_ranges(&file.nodes[index], text, comments) {
                if let Some(js_doc) = parse_jsdoc_comment(text, range.0, range.1) {
                    let id = JSDocId(file.js_docs.len() as u32);
                    file.js_docs.push(js_doc);
                    file.nodes[index].js_doc.push(id);
                }
            }
        }
        file
    }

    fn push(
        &mut self,
        kind: SyntaxKind,
        start: u32,
        end: u32,
        parent: Option<TsNodeId>,
        ast: Option<NodeId>,
    ) -> TsNodeId {
        let id = TsNodeId(self.nodes.len() as u32);
        self.nodes.push(TsNode {
            kind,
            pos: start,
            start,
            end,
            parent,
            children: Vec::new(),
            ast,
            js_doc: Vec::new(),
            initializer: None,
            is_assignment: false,
        });
        if let Some(parent) = parent {
            self.nodes[parent.0 as usize].children.push(id);
        }
        id
    }

    fn mapping(kind: AstKind, parent_kind: Option<AstKind>) -> Mapping {
        use SyntaxKind as K;
        Mapping::Node(match kind {
            AstKind::Program(_) => K::SourceFile,
            AstKind::IdentifierName(_)
            | AstKind::IdentifierReference(_)
            | AstKind::BindingIdentifier(_)
            | AstKind::LabelIdentifier(_) => K::Identifier,
            AstKind::PrivateIdentifier(_) => K::PrivateIdentifier,
            AstKind::ObjectExpression(_) => K::ObjectLiteralExpression,
            AstKind::ObjectProperty(property) => match property.kind {
                PropertyKind::Get => K::GetAccessor,
                PropertyKind::Set => K::SetAccessor,
                PropertyKind::Init if property.method => K::MethodDeclaration,
                PropertyKind::Init if property.shorthand => K::ShorthandPropertyAssignment,
                PropertyKind::Init => K::PropertyAssignment,
            },
            AstKind::StaticMemberExpression(_) | AstKind::PrivateFieldExpression(_) => {
                K::PropertyAccessExpression
            }
            AstKind::ComputedMemberExpression(_) => K::ElementAccessExpression,
            AstKind::SpreadElement(_) => match parent_kind {
                Some(AstKind::ObjectExpression(_)) => K::SpreadAssignment,
                _ => K::SpreadElement,
            },
            AstKind::BinaryExpression(_)
            | AstKind::LogicalExpression(_)
            | AstKind::PrivateInExpression(_)
            | AstKind::AssignmentExpression(_) => K::BinaryExpression,
            AstKind::ParenthesizedExpression(_) => K::ParenthesizedExpression,
            AstKind::ChainExpression(_) => return Mapping::Skip,
            AstKind::Directive(_) => K::ExpressionStatement,
            AstKind::Hashbang(_) => return Mapping::Skip,
            AstKind::BlockStatement(_) | AstKind::FunctionBody(_) => K::Block,
            AstKind::VariableDeclaration(_) => match parent_kind {
                Some(
                    AstKind::ForStatement(_)
                    | AstKind::ForInStatement(_)
                    | AstKind::ForOfStatement(_),
                ) => K::VariableDeclarationList,
                _ => return Mapping::VariableStatement,
            },
            AstKind::VariableDeclarator(_) | AstKind::CatchParameter(_) => K::VariableDeclaration,
            AstKind::EmptyStatement(_) => K::EmptyStatement,
            AstKind::ExpressionStatement(_) => K::ExpressionStatement,
            AstKind::IfStatement(_) => K::IfStatement,
            AstKind::DoWhileStatement(_) => K::DoStatement,
            AstKind::WhileStatement(_) => K::WhileStatement,
            AstKind::ForStatement(_) => K::ForStatement,
            AstKind::ForInStatement(_) => K::ForInStatement,
            AstKind::ForOfStatement(_) => K::ForOfStatement,
            AstKind::ContinueStatement(_) => K::ContinueStatement,
            AstKind::BreakStatement(_) => K::BreakStatement,
            AstKind::ReturnStatement(_) => K::ReturnStatement,
            AstKind::WithStatement(_) => K::WithStatement,
            AstKind::SwitchStatement(_) => K::SwitchStatement,
            AstKind::SwitchCase(case) => {
                if case.test.is_some() {
                    K::CaseClause
                } else {
                    K::DefaultClause
                }
            }
            AstKind::LabeledStatement(_) => K::LabeledStatement,
            AstKind::ThrowStatement(_) => K::ThrowStatement,
            AstKind::TryStatement(_) => K::TryStatement,
            AstKind::CatchClause(_) => K::CatchClause,
            AstKind::DebuggerStatement(_) => K::DebuggerStatement,
            AstKind::BindingProperty(_) => K::BindingElement,
            AstKind::Function(function) => match parent_kind {
                // The function of a method is the method itself.
                Some(AstKind::MethodDefinition(_)) => return Mapping::Skip,
                Some(AstKind::ObjectProperty(property))
                    if property.method || property.kind != PropertyKind::Init =>
                {
                    return Mapping::Skip;
                }
                _ => match function.r#type {
                    FunctionType::FunctionDeclaration | FunctionType::TSDeclareFunction => {
                        K::FunctionDeclaration
                    }
                    FunctionType::FunctionExpression
                    | FunctionType::TSEmptyBodyFunctionExpression => K::FunctionExpression,
                },
            },
            AstKind::FormalParameters(_) => return Mapping::Skip,
            AstKind::FormalParameter(_)
            | AstKind::FormalParameterRest(_)
            | AstKind::TSThisParameter(_)
            | AstKind::TSIndexSignatureName(_) => K::Parameter,
            AstKind::ArrowFunctionExpression(_) => K::ArrowFunction,
            AstKind::Class(class) => match class.r#type {
                ClassType::ClassDeclaration => K::ClassDeclaration,
                ClassType::ClassExpression => K::ClassExpression,
            },
            AstKind::ClassBody(_) => return Mapping::Skip,
            AstKind::MethodDefinition(method) => match method.kind {
                MethodDefinitionKind::Constructor => K::Constructor,
                MethodDefinitionKind::Method => K::MethodDeclaration,
                MethodDefinitionKind::Get => K::GetAccessor,
                MethodDefinitionKind::Set => K::SetAccessor,
            },
            AstKind::PropertyDefinition(_) | AstKind::AccessorProperty(_) => K::PropertyDeclaration,
            AstKind::StaticBlock(_) => K::ClassStaticBlockDeclaration,
            AstKind::ImportDeclaration(_) => K::ImportDeclaration,
            // PORT: oxc's `ExportDeclaration` is an exported declaration,
            // which TypeScript represents as a declaration with an `export`
            // modifier.
            AstKind::ExportDeclaration(_) => return Mapping::Skip,
            AstKind::ExportNamedDeclaration(_)
            | AstKind::ExportFromDeclaration(_)
            | AstKind::ExportAllDeclaration(_) => K::ExportDeclaration,
            AstKind::ExportDefaultDeclaration(export) => match export.declaration {
                ExportDefaultDeclarationKind::FunctionDeclaration(_)
                | ExportDefaultDeclarationKind::ClassDeclaration(_)
                | ExportDefaultDeclarationKind::TSInterfaceDeclaration(_) => {
                    return Mapping::Skip;
                }
                _ => K::ExportAssignment,
            },
            AstKind::ExportSpecifier(_) => K::ExportSpecifier,
            AstKind::TSEnumDeclaration(_) => K::EnumDeclaration,
            AstKind::TSEnumBody(_) => return Mapping::Skip,
            AstKind::TSEnumMember(_) => K::EnumMember,
            AstKind::TSTypeAnnotation(_) => return Mapping::Skip,
            AstKind::TSNamedTupleMember(_) => K::NamedTupleMember,
            AstKind::TSTypeParameterInstantiation(_) | AstKind::TSTypeParameterDeclaration(_) => {
                return Mapping::Skip;
            }
            AstKind::TSTypeParameter(_) => K::TypeParameter,
            AstKind::TSTypeAliasDeclaration(_) => K::TypeAliasDeclaration,
            AstKind::TSInterfaceDeclaration(_) => K::InterfaceDeclaration,
            AstKind::TSInterfaceBody(_) => return Mapping::Skip,
            AstKind::TSPropertySignature(_) => K::PropertySignature,
            AstKind::TSIndexSignature(_) => K::IndexSignature,
            AstKind::TSCallSignatureDeclaration(_) => K::CallSignature,
            AstKind::TSMethodSignature(method) => match method.kind {
                TSMethodSignatureKind::Method => K::MethodSignature,
                TSMethodSignatureKind::Get => K::GetAccessor,
                TSMethodSignatureKind::Set => K::SetAccessor,
            },
            AstKind::TSConstructSignatureDeclaration(_) => K::ConstructSignature,
            AstKind::TSExternalModuleDeclaration(_)
            | AstKind::TSNamespaceDeclaration(_)
            | AstKind::TSGlobalDeclaration(_) => K::ModuleDeclaration,
            AstKind::TSModuleBlock(_) => K::ModuleBlock,
            AstKind::TSTypeLiteral(_) => K::TypeLiteral,
            AstKind::TSFunctionType(_) => K::FunctionType,
            AstKind::TSConstructorType(_) => K::ConstructorType,
            AstKind::TSImportEqualsDeclaration(_) => K::ImportEqualsDeclaration,
            AstKind::Decorator(_) => K::Decorator,
            AstKind::TSExportAssignment(_) => K::ExportAssignment,
            AstKind::TSNamespaceExportDeclaration(_) => K::NamespaceExportDeclaration,
            _ => K::Other,
        })
    }

    /// Whether TypeScript's parser attaches JSDoc comments to the node
    /// (`withJSDoc`).
    fn has_js_doc_kind(&self, id: TsNodeId, text: &str) -> bool {
        use SyntaxKind as K;
        let node = self.node(id);
        match node.kind {
            K::EndOfFileToken
            | K::Parameter
            | K::CallSignature
            | K::ConstructSignature
            | K::IndexSignature
            | K::PropertySignature
            | K::MethodSignature
            | K::NamedTupleMember
            | K::FunctionType
            | K::ConstructorType
            | K::ArrowFunction
            | K::ParenthesizedExpression
            | K::SpreadAssignment
            | K::PropertyAssignment
            | K::ShorthandPropertyAssignment
            | K::FunctionExpression
            | K::Block
            | K::EmptyStatement
            | K::IfStatement
            | K::DoStatement
            | K::WhileStatement
            | K::ForStatement
            | K::ForInStatement
            | K::ForOfStatement
            | K::BreakStatement
            | K::ContinueStatement
            | K::ReturnStatement
            | K::WithStatement
            | K::CaseClause
            | K::SwitchStatement
            | K::ThrowStatement
            | K::TryStatement
            | K::DebuggerStatement
            | K::LabeledStatement
            | K::VariableDeclaration
            | K::VariableStatement
            | K::FunctionDeclaration
            | K::Constructor
            | K::MethodDeclaration
            | K::PropertyDeclaration
            | K::GetAccessor
            | K::SetAccessor
            | K::ClassStaticBlockDeclaration
            | K::ClassDeclaration
            | K::ClassExpression
            | K::InterfaceDeclaration
            | K::TypeAliasDeclaration
            | K::EnumMember
            | K::EnumDeclaration
            | K::NamespaceExportDeclaration
            | K::ImportDeclaration
            | K::ImportEqualsDeclaration
            | K::ExportSpecifier
            | K::ExportDeclaration
            | K::ExportAssignment => true,
            // An expression statement which starts with a parenthesis
            // doesn't have JSDoc comments, which belong to the parenthesized
            // expression.
            K::ExpressionStatement => text.as_bytes().get(node.start as usize) != Some(&b'('),
            // The inner declarations of `namespace A.B {}` don't have JSDoc
            // comments.
            K::ModuleDeclaration => !node
                .parent
                .is_some_and(|parent| self.node(parent).kind == K::ModuleDeclaration),
            _ => false,
        }
    }

    pub fn root(&self) -> TsNodeId {
        TsNodeId(0)
    }

    pub fn node(&self, id: TsNodeId) -> &TsNode {
        &self.nodes[id.0 as usize]
    }

    /// The nodes in the order `forEachChild` visits them, depth first.
    pub fn nodes(&self) -> impl Iterator<Item = TsNodeId> + use<> {
        (0..self.nodes.len() as u32).map(TsNodeId)
    }

    /// The node built from an oxc node. For a `VariableDeclaration`, it's
    /// the `VariableStatement`.
    pub fn from_ast(&self, id: NodeId) -> Option<TsNodeId> {
        self.by_ast.get(id)
    }

    pub fn js_doc(&self, id: JSDocId) -> &JSDoc {
        &self.js_docs[id.0 as usize]
    }

    pub fn tag(&self, id: TagId) -> &super::parser::JSDocTag {
        &self.js_doc(id.js_doc).tags[id.index as usize]
    }

    pub fn tags(&self, id: JSDocId) -> impl Iterator<Item = TagId> + use<> {
        let count = self.js_docs[id.0 as usize].tags.len() as u32;
        (0..count).map(move |index| TagId { js_doc: id, index })
    }
}

/// PORT: `getJSDocCommentRanges`, returning each range's start and end.
fn get_js_doc_comment_ranges(
    node: &TsNode,
    text: &str,
    comments: &[oxc_ast::Comment],
) -> Vec<(u32, u32)> {
    use SyntaxKind as K;
    let comment_ranges = if matches!(
        node.kind,
        K::Parameter
            | K::TypeParameter
            | K::FunctionExpression
            | K::ArrowFunction
            | K::ParenthesizedExpression
            | K::VariableDeclaration
            | K::ExportSpecifier
    ) {
        let mut ranges = get_trailing_comment_ranges(node, text, comments);
        ranges.extend(get_leading_comment_ranges(node, text, comments));
        ranges
    } else {
        get_leading_comment_ranges(node, text, comments)
    };
    let bytes = text.as_bytes();
    comment_ranges
        .into_iter()
        // Due to parse errors sometime empty parameter may get comments assigned to it that end up not in parameter range
        .filter(|comment| {
            let pos = comment.start as usize;
            comment.end <= node.end
                && bytes.get(pos + 1) == Some(&b'*')
                && bytes.get(pos + 2) == Some(&b'*')
                && bytes.get(pos + 3) != Some(&b'/')
        })
        .map(|comment| (comment.start, comment.end))
        .collect()
}

fn get_leading_comment_ranges(
    node: &TsNode,
    text: &str,
    comments: &[oxc_ast::Comment],
) -> Vec<Span> {
    comment_ranges(node, text, comments, false)
}

fn get_trailing_comment_ranges(
    node: &TsNode,
    text: &str,
    comments: &[oxc_ast::Comment],
) -> Vec<Span> {
    comment_ranges(node, text, comments, true)
}

/// PORT: `getLeadingCommentRanges` and `getTrailingCommentRanges` at the
/// node's `pos`, which scan the comments before its first token. Those are
/// the comments oxc found between `pos` and `start`, since there's only
/// trivia between them. Leading comments are those after the first line
/// break, or all of them at the start of the file. Trailing comments are
/// those before it. Only `\r` and `\n` count as line breaks here.
fn comment_ranges(
    node: &TsNode,
    text: &str,
    comments: &[oxc_ast::Comment],
    trailing: bool,
) -> Vec<Span> {
    let first = comments.partition_point(|comment| comment.span.start < node.pos);
    let mut collecting = trailing || node.pos == 0;
    // The start of the trivia before the next comment. At the start of the
    // file, this includes any hashbang, which ends at a line break.
    let mut trivia_start = node.pos;
    let mut ranges = Vec::new();
    for comment in comments[first..]
        .iter()
        .take_while(|comment| comment.span.end <= node.start)
    {
        if text[trivia_start as usize..comment.span.start as usize].contains(['\r', '\n']) {
            if trailing {
                break;
            }
            collecting = true;
        }
        if collecting {
            ranges.push(comment.span);
        }
        trivia_start = comment.span.end;
    }
    ranges
}

/// The end of the token before `start`: `start`, less any whitespace and
/// comments before it.
pub(crate) fn full_start(
    text: &str,
    start: u32,
    comments: &[oxc_ast::Comment],
    hashbang_end: Option<u32>,
) -> u32 {
    let mut pos = start as usize;
    loop {
        while let Some(ch) = text[..pos]
            .chars()
            .next_back()
            .filter(|&ch| is_white_space_like(ch))
        {
            pos -= ch.len_utf8();
        }
        let index = comments.partition_point(|comment| (comment.span.end as usize) < pos);
        match comments.get(index) {
            Some(comment) if comment.span.end as usize == pos => pos = comment.span.start as usize,
            _ => break,
        }
    }
    // A hashbang is trivia before the first token.
    if hashbang_end == Some(pos as u32) {
        pos = 0;
    }
    pos as u32
}

/// Whether a node with `span` is the computed key of `owner`.
fn is_computed_key(owner: AstKind, span: Span) -> bool {
    let (computed, key) = match owner {
        AstKind::PropertyDefinition(node) => (node.computed, &node.key),
        AstKind::MethodDefinition(node) => (node.computed, &node.key),
        AstKind::AccessorProperty(node) => (node.computed, &node.key),
        AstKind::ObjectProperty(node) => (node.computed, &node.key),
        AstKind::TSPropertySignature(node) => (node.computed, &node.key),
        AstKind::TSMethodSignature(node) => (node.computed, &node.key),
        AstKind::BindingProperty(node) => (node.computed, &node.key),
        _ => return false,
    };
    computed && key.span() == span
}

/// PORT: `skipTrivia`, for the whitespace and comments after a modifier.
pub(crate) fn skip_trivia(text: &str, pos: u32, comments: &[oxc_ast::Comment]) -> u32 {
    let mut pos = pos as usize;
    loop {
        let rest = &text[pos..];
        pos += rest.len() - rest.trim_start_matches(is_white_space_like).len();
        let index = comments.partition_point(|comment| (comment.span.start as usize) < pos);
        match comments.get(index) {
            Some(comment) if comment.span.start as usize == pos => pos = comment.span.end as usize,
            _ => return pos as u32,
        }
    }
}
