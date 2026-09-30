//! Port of graphql-js `validation/rules/LoneSchemaDefinitionRule.ts`.

use crate::error::graphql_error::GraphQLError;
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::validation::validation_context::SDLValidationContext;

/// Lone Schema definition
///
/// A GraphQL document is only valid if it contains only one schema definition.
///
/// PORT: There is no schema being extended (see `SDLValidationContext`), so no
/// schema is already defined.
pub fn lone_schema_definition_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    Box::new(LoneSchemaDefinitionRule {
        context,
        schema_definitions_count: 0,
    })
}

struct LoneSchemaDefinitionRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    schema_definitions_count: usize,
}

impl<'n> ASTVisitor<'n> for LoneSchemaDefinitionRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        if let ASTNode::SchemaDefinition(node) = node {
            if self.schema_definitions_count > 0 {
                self.context.report_error(GraphQLError::new(
                    "Must provide only one schema definition.".to_string(),
                    vec![node.loc],
                ));
            }
            self.schema_definitions_count += 1;
        }
        VisitAction::Continue
    }
}
