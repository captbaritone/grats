//! Port of graphql-js `validation/rules/UniqueArgumentNamesRule.ts`.

use crate::error::graphql_error::GraphQLError;
use crate::jsutils::group_by::group_by;
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::validation::validation_context::SDLValidationContext;

/// Unique argument names
///
/// A GraphQL field or directive is only valid if all supplied arguments are
/// uniquely named.
///
/// See https://spec.graphql.org/draft/#sec-Argument-Names
///
/// PORT: Fields with arguments only exist in executable documents, so only
/// directives are checked.
pub fn unique_argument_names_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    Box::new(UniqueArgumentNamesRule { context })
}

struct UniqueArgumentNamesRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
}

impl<'n> ASTVisitor<'n> for UniqueArgumentNamesRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        let ASTNode::Directive(parent_node) = node else {
            return VisitAction::Continue;
        };

        // FIXME: https://github.com/graphql/graphql-js/issues/2203
        let argument_nodes = parent_node.arguments.as_deref().unwrap_or_default();

        let seen_args = group_by(argument_nodes, |arg| arg.name.value.as_str());

        for (arg_name, arg_nodes) in seen_args {
            if arg_nodes.len() > 1 {
                self.context.report_error(GraphQLError::new(
                    format!("There can be only one argument named \"{arg_name}\"."),
                    arg_nodes.iter().map(|node| node.name.loc).collect(),
                ));
            }
        }
        VisitAction::Continue
    }
}
