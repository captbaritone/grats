//! Ports of the JSDoc functions of TypeScript's `utilities.ts` and
//! `utilitiesPublic.ts`, and of Grats' `utils/JSDoc.ts`.

use std::collections::HashSet;

use super::nodes::{JSDocId, JSDocIndex, SyntaxKind, TagId, TsNodeId};
use super::parser::{JSDocComment, JSDocCommentPart, JSDocLinkKind};

/// PORT: `JSDoc | JSDocTag`, the items of `getJSDocCommentsAndTags`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JSDocOrTag {
    JSDoc(JSDocId),
    Tag(TagId),
}

impl JSDocIndex {
    pub fn can_have_js_doc(&self, node: TsNodeId) -> bool {
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

    pub fn has_js_doc_nodes(&self, node: TsNodeId) -> bool {
        if !self.can_have_js_doc(node) {
            return false;
        }
        !self.node(node).js_doc.is_empty()
    }

    /// Get all JSDoc tags related to a node, including those on parent nodes.
    pub fn get_js_doc_tags(&self, node: TsNodeId) -> Vec<TagId> {
        if !self.can_have_js_doc(node) {
            return Vec::new();
        }
        let comments = self.get_js_doc_comments_and_tags(node);
        comments
            .into_iter()
            .flat_map(|j| match j {
                JSDocOrTag::JSDoc(js_doc) => self.tags(js_doc).collect::<Vec<_>>(),
                JSDocOrTag::Tag(tag) => vec![tag],
            })
            .collect()
    }

    /// PORT: `@param` and `@template` tags aren't included for parameters
    /// and type parameters. Since they come last, the other tags are the
    /// same.
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
            if self.node(current).kind == SyntaxKind::Parameter {
                break;
            }
            if self.node(current).kind == SyntaxKind::TypeParameter {
                break;
            }
            node = self.get_next_js_doc_comment_location(current);
        }
        result
    }

    /// PORT: `ownsJSDocTag` is always true, since only `@type` and
    /// `@satisfies` tags on parenthesized expressions can be disowned, and
    /// they aren't parsed as such (see `parser`).
    fn filter_owned_js_doc_tags(&self, comments: &[JSDocId]) -> Vec<JSDocOrTag> {
        let Some(&last_js_doc) = comments.last() else {
            return Vec::new();
        };
        comments
            .iter()
            .flat_map(|&js_doc| {
                if js_doc == last_js_doc {
                    vec![JSDocOrTag::JSDoc(js_doc)]
                } else {
                    self.tags(js_doc)
                        .filter(|&tag| self.tag(tag).tag_name.text == "overload")
                        .map(JSDocOrTag::Tag)
                        .collect()
                }
            })
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
            || self.get_nested_module_declaration(parent).is_some()
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
        // PORT: `getSourceOfDefaultedAssignment` is only for JavaScript.
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

    /// PORT: `isAssignmentExpression`, for any assignment operator.
    fn is_assignment_expression(&self, node: TsNodeId) -> bool {
        self.node(node).is_assignment
    }

    fn get_nested_module_declaration(&self, node: TsNodeId) -> Option<TsNodeId> {
        if self.node(node).kind != SyntaxKind::ModuleDeclaration {
            return None;
        }
        self.node(node)
            .children
            .iter()
            .copied()
            .find(|&child| self.node(child).kind == SyntaxKind::ModuleDeclaration)
    }

    pub fn get_single_variable_of_variable_statement(&self, node: TsNodeId) -> Option<TsNodeId> {
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

    /// PORT: `isDeclarationStatement`. oxc doesn't produce
    /// `MissingDeclaration`s.
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

    /// PORT: Grats' `traverseJSDocTags`.
    ///
    /// Recursively search for all JSDoc tags calling `cb` on each one with
    /// its direct parent node.
    pub fn traverse_js_doc_tags(&self, mut cb: impl FnMut(TsNodeId, TagId)) {
        // Typescript only has an API to get the JSDoc tags for a node AND all of its
        // parents. So, we rely on the fact that we are recursing breadth-first and
        // only call the callback the first time we encounter a tag.  This should
        // ensure we only ever call the callback once per tag, and that we call it
        // with the tag's "true" parent node.
        let mut seen_tags: HashSet<TagId> = HashSet::new();
        // PORT: The nodes are already in the order `forEachChild` visits
        // them.
        for node in self.nodes() {
            for tag in self.get_js_doc_tags(node) {
                if seen_tags.contains(&tag) {
                    break;
                }
                seen_tags.insert(tag);
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
                .map(|c| match c {
                    JSDocCommentPart::Text(text) => text.clone(),
                    link => format_js_doc_link(link),
                })
                .collect(),
        ),
    }
}

fn format_js_doc_link(link: &JSDocCommentPart) -> String {
    let JSDocCommentPart::Link {
        kind, name, text, ..
    } = link
    else {
        unreachable!()
    };
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
    format!("{{@{kind} {}{space}{text}}}", name.as_deref().unwrap_or(""))
}
