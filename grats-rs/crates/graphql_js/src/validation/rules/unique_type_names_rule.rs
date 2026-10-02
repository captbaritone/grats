//! Port of graphql-js `validation/rules/UniqueTypeNamesRule.ts`.

use rustc_hash::FxHashMap;

use crate::error::graphql_error::GraphQLError;
use crate::language::ast::NameNode;
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::validation::validation_context::SDLValidationContext;

/// Unique type names
///
/// A GraphQL document is only valid if all defined types have unique names.
///
/// PORT: There is no schema being extended (see `SDLValidationContext`), so no
/// types already exist.
pub fn unique_type_names_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    Box::new(UniqueTypeNamesRule {
        context,
        known_type_names: FxHashMap::default(),
    })
}

struct UniqueTypeNamesRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    known_type_names: FxHashMap<&'n str, &'n NameNode>,
}

impl<'n> ASTVisitor<'n> for UniqueTypeNamesRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        match node {
            ASTNode::ScalarTypeDefinition(node) => self.check_type_name(&node.name),
            ASTNode::ObjectTypeDefinition(node) => self.check_type_name(&node.name),
            ASTNode::InterfaceTypeDefinition(node) => self.check_type_name(&node.name),
            ASTNode::UnionTypeDefinition(node) => self.check_type_name(&node.name),
            ASTNode::EnumTypeDefinition(node) => self.check_type_name(&node.name),
            ASTNode::InputObjectTypeDefinition(node) => self.check_type_name(&node.name),
            _ => VisitAction::Continue,
        }
    }
}

impl<'n> UniqueTypeNamesRule<'_, 'n> {
    /// PORT: graphql-js passes the whole node, of which only the name is read.
    fn check_type_name(&mut self, name: &'n NameNode) -> VisitAction {
        let type_name = name.value.as_str();

        if let Some(known_type_name) = self.known_type_names.get(type_name) {
            self.context.report_error(GraphQLError::new(
                format!("There can be only one type named \"{type_name}\"."),
                vec![known_type_name.loc, name.loc],
            ));
        } else {
            self.known_type_names.insert(type_name, name);
        }

        VisitAction::Skip
    }
}
