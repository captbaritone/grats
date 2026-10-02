//! Port of graphql-js `validation/rules/UniqueDirectiveNamesRule.ts`.

use std::collections::HashMap;

use crate::error::graphql_error::GraphQLError;
use crate::language::ast::NameNode;
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::validation::validation_context::SDLValidationContext;

/// Unique directive names
///
/// A GraphQL document is only valid if all defined directives have unique names.
///
/// PORT: There is no schema being extended (see `SDLValidationContext`), so no
/// directives already exist.
pub fn unique_directive_names_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    Box::new(UniqueDirectiveNamesRule {
        context,
        known_directive_names: HashMap::new(),
    })
}

struct UniqueDirectiveNamesRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    known_directive_names: HashMap<&'n str, &'n NameNode>,
}

impl<'n> ASTVisitor<'n> for UniqueDirectiveNamesRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        let ASTNode::DirectiveDefinition(node) = node else {
            return VisitAction::Continue;
        };
        let directive_name = node.name.value.as_str();

        if let Some(known_directive_name) = self.known_directive_names.get(directive_name) {
            self.context.report_error(GraphQLError::new(
                format!("There can be only one directive named \"@{directive_name}\"."),
                vec![known_directive_name.loc, node.name.loc],
            ));
        } else {
            self.known_directive_names
                .insert(directive_name, &node.name);
        }

        VisitAction::Skip
    }
}
