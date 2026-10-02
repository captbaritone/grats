//! Finds the JSDoc of nodes. Which nodes a docblock applies to follows
//! TypeScript's `getJSDocCommentsAndTags`, so that tags apply to the same
//! nodes they did when Grats used TypeScript's parser.

use std::collections::HashSet;

use super::nodes::{JSDocId, JSDocIndex, SyntaxKind, TagId, TsNodeId};
use super::parser::{JSDocComment, JSDocCommentPart, JSDocLinkKind};

/// A whole docblock, or one of the `@overload` tags of a docblock before the
/// last one of a node.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JSDocOrTag {
    JSDoc(JSDocId),
    Tag(TagId),
}

impl JSDocIndex {
    fn can_have_js_doc(&self, node: TsNodeId) -> bool {
        use SyntaxKind as K;
        matches!(
            self.node(node).kind,
            K::ArrowFunction
                | K::BinaryExpression
                | K::Block
                | K::BreakStatement
                | K::CallSignature
                | K::CaseClause
                | K::ClassDeclaration
                | K::ClassExpression
                | K::ClassStaticBlockDeclaration
                | K::Constructor
                | K::ConstructorType
                | K::ConstructSignature
                | K::ContinueStatement
                | K::DebuggerStatement
                | K::DoStatement
                | K::ElementAccessExpression
                | K::EmptyStatement
                | K::EndOfFileToken
                | K::EnumDeclaration
                | K::EnumMember
                | K::ExportAssignment
                | K::ExportDeclaration
                | K::ExportSpecifier
                | K::ExpressionStatement
                | K::ForInStatement
                | K::ForOfStatement
                | K::ForStatement
                | K::FunctionDeclaration
                | K::FunctionExpression
                | K::FunctionType
                | K::GetAccessor
                | K::Identifier
                | K::IfStatement
                | K::ImportDeclaration
                | K::ImportEqualsDeclaration
                | K::IndexSignature
                | K::InterfaceDeclaration
                | K::LabeledStatement
                | K::MethodDeclaration
                | K::MethodSignature
                | K::ModuleDeclaration
                | K::NamedTupleMember
                | K::NamespaceExportDeclaration
                | K::ObjectLiteralExpression
                | K::Parameter
                | K::ParenthesizedExpression
                | K::PropertyAccessExpression
                | K::PropertyAssignment
                | K::PropertyDeclaration
                | K::PropertySignature
                | K::ReturnStatement
                | K::SetAccessor
                | K::ShorthandPropertyAssignment
                | K::SpreadAssignment
                | K::SwitchStatement
                | K::ThrowStatement
                | K::TryStatement
                | K::TypeAliasDeclaration
                | K::TypeParameter
                | K::VariableDeclaration
                | K::VariableStatement
                | K::WhileStatement
                | K::WithStatement
        )
    }

    fn has_js_doc_nodes(&self, node: TsNodeId) -> bool {
        self.can_have_js_doc(node) && !self.node(node).js_doc.is_empty()
    }

    /// Get all JSDoc tags related to a node, including those on parent nodes.
    pub fn get_js_doc_tags(&self, node: TsNodeId) -> Vec<TagId> {
        if !self.can_have_js_doc(node) {
            return Vec::new();
        }
        self.get_js_doc_comments_and_tags(node)
            .into_iter()
            .flat_map(|item| match item {
                JSDocOrTag::JSDoc(js_doc) => self.tags(js_doc).collect::<Vec<_>>(),
                JSDocOrTag::Tag(tag) => vec![tag],
            })
            .collect()
    }

    /// The JSDoc which applies to a node, including the JSDoc of the nodes
    /// it's part of, like the variable statement of a variable declaration.
    ///
    /// Unlike TypeScript, the `@param` and `@template` tags of a function
    /// aren't included for its parameters and type parameters. Since they
    /// come last, the other tags are the same.
    pub fn get_js_doc_comments_and_tags(&self, host_node: TsNodeId) -> Vec<JSDocOrTag> {
        let mut result = Vec::new();
        if self.is_variable_like(host_node)
            && let Some(initializer) = self.node(host_node).initializer
            && self.has_js_doc_nodes(initializer)
        {
            result.extend(self.filter_owned_js_doc_tags(&self.node(initializer).js_doc));
        }
        let mut node = Some(host_node);
        while let Some(current) = node
            && self.node(current).parent.is_some()
        {
            if self.has_js_doc_nodes(current) {
                result.extend(self.filter_owned_js_doc_tags(&self.node(current).js_doc));
            }
            if matches!(
                self.node(current).kind,
                SyntaxKind::Parameter | SyntaxKind::TypeParameter
            ) {
                break;
            }
            node = self.get_next_js_doc_comment_location(current);
        }
        result
    }

    /// The last of a node's docblocks, after the `@overload` tags of the
    /// others.
    ///
    /// TypeScript also leaves out the `@type` and `@satisfies` tags of
    /// parenthesized expressions, which aren't parsed as such (see `parser`).
    fn filter_owned_js_doc_tags(&self, comments: &[JSDocId]) -> Vec<JSDocOrTag> {
        let Some((&last_js_doc, rest)) = comments.split_last() else {
            return Vec::new();
        };
        rest.iter()
            .flat_map(|&js_doc| self.tags(js_doc))
            .filter(|&tag| self.tag(tag).tag_name.text == "overload")
            .map(JSDocOrTag::Tag)
            .chain([JSDocOrTag::JSDoc(last_js_doc)])
            .collect()
    }

    fn get_next_js_doc_comment_location(&self, node: TsNodeId) -> Option<TsNodeId> {
        use SyntaxKind as K;
        let parent = self.node(node).parent?;
        let parent_kind = self.node(parent).kind;
        if matches!(
            parent_kind,
            K::PropertyAssignment | K::ExportAssignment | K::PropertyDeclaration
        ) || (parent_kind == K::ExpressionStatement
            && self.node(node).kind == K::PropertyAccessExpression)
            || parent_kind == K::ReturnStatement
            || self.has_nested_module_declaration(parent)
            || self.is_assignment_expression(node)
        {
            return Some(parent);
        }
        let grandparent = self.node(parent).parent?;
        if self.get_single_variable_of_variable_statement(grandparent) == Some(node)
            || self.is_assignment_expression(parent)
        {
            return Some(grandparent);
        }
        let great_grandparent = self.node(grandparent).parent?;
        // TypeScript also checks `getSourceOfDefaultedAssignment`, which is
        // only for JavaScript.
        if self
            .get_single_variable_of_variable_statement(great_grandparent)
            .is_some()
            || self.get_single_initializer_of_variable_statement_or_property_declaration(
                great_grandparent,
            ) == Some(node)
        {
            return Some(great_grandparent);
        }
        None
    }

    fn is_variable_like(&self, node: TsNodeId) -> bool {
        use SyntaxKind as K;
        matches!(
            self.node(node).kind,
            K::BindingElement
                | K::EnumMember
                | K::Parameter
                | K::PropertyAssignment
                | K::PropertyDeclaration
                | K::PropertySignature
                | K::ShorthandPropertyAssignment
                | K::VariableDeclaration
        )
    }

    /// Whether the node is an assignment, with any assignment operator.
    fn is_assignment_expression(&self, node: TsNodeId) -> bool {
        self.node(node).is_assignment
    }

    /// Whether the node is a module declaration with a module declaration in
    /// it, like `namespace A.B {}`.
    fn has_nested_module_declaration(&self, node: TsNodeId) -> bool {
        let node = self.node(node);
        node.kind == SyntaxKind::ModuleDeclaration
            && node
                .children
                .iter()
                .any(|&child| self.node(child).kind == SyntaxKind::ModuleDeclaration)
    }

    fn get_single_variable_of_variable_statement(&self, node: TsNodeId) -> Option<TsNodeId> {
        if self.node(node).kind != SyntaxKind::VariableStatement {
            return None;
        }
        let list = self
            .node(node)
            .children
            .iter()
            .copied()
            .find(|&child| self.node(child).kind == SyntaxKind::VariableDeclarationList)?;
        self.node(list)
            .children
            .iter()
            .copied()
            .find(|&child| self.node(child).kind == SyntaxKind::VariableDeclaration)
    }

    fn get_single_initializer_of_variable_statement_or_property_declaration(
        &self,
        node: TsNodeId,
    ) -> Option<TsNodeId> {
        match self.node(node).kind {
            SyntaxKind::VariableStatement => {
                let v = self.get_single_variable_of_variable_statement(node)?;
                self.node(v).initializer
            }
            SyntaxKind::PropertyDeclaration | SyntaxKind::PropertyAssignment => {
                self.node(node).initializer
            }
            _ => None,
        }
    }

    /// Like TypeScript's `isDeclarationStatement`, besides
    /// `MissingDeclaration`s, which oxc doesn't produce.
    pub fn is_declaration_statement(&self, node: TsNodeId) -> bool {
        use SyntaxKind as K;
        matches!(
            self.node(node).kind,
            K::FunctionDeclaration
                | K::ClassDeclaration
                | K::InterfaceDeclaration
                | K::TypeAliasDeclaration
                | K::EnumDeclaration
                | K::ModuleDeclaration
                | K::ImportDeclaration
                | K::ImportEqualsDeclaration
                | K::ExportDeclaration
                | K::ExportAssignment
                | K::NamespaceExportDeclaration
        )
    }

    /// Calls `cb` on each JSDoc tag in the file with its direct parent node.
    pub fn traverse_js_doc_tags(&self, mut cb: impl FnMut(TsNodeId, TagId)) {
        // `get_js_doc_tags` gets the JSDoc tags for a node AND all of the nodes
        // it's part of. So, we rely on the fact that we visit parents before
        // their children and only call the callback the first time we
        // encounter a tag. This should ensure we only ever call the callback
        // once per tag, and that we call it with the tag's "true" parent node.
        let mut seen_tags: HashSet<TagId> = HashSet::new();
        for node in self.nodes() {
            for tag in self.get_js_doc_tags(node) {
                if !seen_tags.insert(tag) {
                    break;
                }
                cb(node, tag);
            }
        }
    }
}

pub fn get_text_of_js_doc_comment(comment: Option<&JSDocComment>) -> Option<String> {
    match comment? {
        JSDocComment::Text(text) => Some(text.clone()),
        JSDocComment::Parts(parts) => Some(
            parts
                .iter()
                .map(|part| match part {
                    JSDocCommentPart::Text(text) => text.clone(),
                    JSDocCommentPart::Link {
                        kind, name, text, ..
                    } => format_js_doc_link(*kind, name.as_deref(), text),
                })
                .collect(),
        ),
    }
}

fn format_js_doc_link(kind: JSDocLinkKind, name: Option<&str>, text: &str) -> String {
    let kind = match kind {
        JSDocLinkKind::Link => "link",
        JSDocLinkKind::LinkCode => "linkcode",
        JSDocLinkKind::LinkPlain => "linkplain",
    };
    let space = if name.is_some() && (text.is_empty() || text.starts_with("://")) {
        ""
    } else {
        " "
    };
    format!("{{@{kind} {}{space}{text}}}", name.unwrap_or(""))
}
