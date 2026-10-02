//! Port of graphql-js `validation/rules/UniqueInputFieldNamesRule.ts`.

use rustc_hash::FxHashMap;

use crate::error::graphql_error::GraphQLError;
use crate::language::ast::{ConstValueNode, NameNode};
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::validation::validation_context::SDLValidationContext;

/// Unique input field names
///
/// A GraphQL input object value is only valid if all supplied fields are
/// uniquely named.
///
/// See https://spec.graphql.org/draft/#sec-Input-Object-Field-Uniqueness
pub fn unique_input_field_names_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    Box::new(UniqueInputFieldNamesRule {
        context,
        known_name_stack: Vec::new(),
        known_names: FxHashMap::default(),
    })
}

struct UniqueInputFieldNamesRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    known_name_stack: Vec<FxHashMap<&'n str, &'n NameNode>>,
    known_names: FxHashMap<&'n str, &'n NameNode>,
}

impl<'n> ASTVisitor<'n> for UniqueInputFieldNamesRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        match node {
            ASTNode::ConstValue(ConstValueNode::ObjectValue(_)) => {
                self.known_name_stack
                    .push(std::mem::take(&mut self.known_names));
            }
            ASTNode::ObjectField(node) => {
                let field_name = node.name.value.as_str();
                if let Some(known_name) = self.known_names.get(field_name) {
                    self.context.report_error(GraphQLError::new(
                        format!("There can be only one input field named \"{field_name}\"."),
                        vec![known_name.loc, node.name.loc],
                    ));
                } else {
                    self.known_names.insert(field_name, &node.name);
                }
            }
            _ => {}
        }
        VisitAction::Continue
    }

    fn leave(&mut self, node: ASTNode<'n>) {
        if let ASTNode::ConstValue(ConstValueNode::ObjectValue(_)) = node {
            let prev_known_names = self.known_name_stack.pop();
            self.known_names = prev_known_names.expect("invariant");
        }
    }
}
