//! Port of graphql-js `validation/rules/UniqueArgumentDefinitionNamesRule.ts`.

use crate::error::graphql_error::GraphQLError;
use crate::jsutils::group_by::group_by;
use crate::language::ast::{FieldDefinitionNode, InputValueDefinitionNode, NameNode};
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::validation::validation_context::SDLValidationContext;

/// Unique argument definition names
///
/// A GraphQL Object or Interface type is only valid if all its fields have uniquely named arguments.
/// A GraphQL Directive is only valid if all its arguments are uniquely named.
pub fn unique_argument_definition_names_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    Box::new(UniqueArgumentDefinitionNamesRule { context })
}

struct UniqueArgumentDefinitionNamesRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
}

impl<'n> ASTVisitor<'n> for UniqueArgumentDefinitionNamesRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        match node {
            ASTNode::DirectiveDefinition(directive_node) => {
                // FIXME: https://github.com/graphql/graphql-js/issues/2203
                let argument_nodes = directive_node.arguments.as_deref().unwrap_or_default();

                self.check_arg_uniqueness(
                    &format!("@{}", directive_node.name.value),
                    argument_nodes,
                )
            }
            ASTNode::InterfaceTypeDefinition(node) => {
                self.check_arg_uniqueness_per_field(&node.name, &node.fields)
            }
            ASTNode::InterfaceTypeExtension(node) => {
                self.check_arg_uniqueness_per_field(&node.name, &node.fields)
            }
            ASTNode::ObjectTypeDefinition(node) => {
                self.check_arg_uniqueness_per_field(&node.name, &node.fields)
            }
            ASTNode::ObjectTypeExtension(node) => {
                self.check_arg_uniqueness_per_field(&node.name, &node.fields)
            }
            _ => VisitAction::Continue,
        }
    }
}

impl UniqueArgumentDefinitionNamesRule<'_, '_> {
    /// PORT: graphql-js passes the whole node, of which only the name and
    /// fields are read.
    fn check_arg_uniqueness_per_field(
        &self,
        name: &NameNode,
        fields: &Option<Vec<FieldDefinitionNode>>,
    ) -> VisitAction {
        let type_name = &name.value;
        // FIXME: https://github.com/graphql/graphql-js/issues/2203
        let field_nodes = fields.as_deref().unwrap_or_default();

        for field_def in field_nodes {
            let field_name = &field_def.name.value;

            // FIXME: https://github.com/graphql/graphql-js/issues/2203
            let argument_nodes = field_def.arguments.as_deref().unwrap_or_default();

            self.check_arg_uniqueness(&format!("{type_name}.{field_name}"), argument_nodes);
        }

        VisitAction::Skip
    }

    fn check_arg_uniqueness(
        &self,
        parent_name: &str,
        argument_nodes: &[InputValueDefinitionNode],
    ) -> VisitAction {
        let seen_args = group_by(argument_nodes, |arg| arg.name.value.as_str());

        for (arg_name, arg_nodes) in seen_args {
            if arg_nodes.len() > 1 {
                self.context.report_error(GraphQLError::new(
                    format!("Argument \"{parent_name}({arg_name}:)\" can only be defined once."),
                    arg_nodes.iter().map(|node| node.name.loc).collect(),
                ));
            }
        }

        VisitAction::Skip
    }
}
