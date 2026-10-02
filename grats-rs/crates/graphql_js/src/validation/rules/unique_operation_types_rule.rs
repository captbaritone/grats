//! Port of graphql-js `validation/rules/UniqueOperationTypesRule.ts`.

use rustc_hash::FxHashMap;

use crate::error::graphql_error::GraphQLError;
use crate::language::ast::OperationTypeDefinitionNode;
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::validation::validation_context::SDLValidationContext;

/// Unique operation types
///
/// A GraphQL document is only valid if it has only one type per operation.
///
/// PORT: There is no schema being extended (see `SDLValidationContext`), so no
/// operation types already exist.
pub fn unique_operation_types_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    Box::new(UniqueOperationTypesRule {
        context,
        defined_operation_types: FxHashMap::default(),
    })
}

struct UniqueOperationTypesRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    defined_operation_types: FxHashMap<&'static str, &'n OperationTypeDefinitionNode>,
}

impl<'n> ASTVisitor<'n> for UniqueOperationTypesRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        match node {
            ASTNode::SchemaDefinition(node) => self.check_operation_types(&node.operation_types),
            ASTNode::SchemaExtension(node) => {
                // See: https://github.com/graphql/graphql-js/issues/2203
                self.check_operation_types(node.operation_types.as_deref().unwrap_or_default())
            }
            _ => VisitAction::Continue,
        }
    }
}

impl<'n> UniqueOperationTypesRule<'_, 'n> {
    fn check_operation_types(
        &mut self,
        operation_types_nodes: &'n [OperationTypeDefinitionNode],
    ) -> VisitAction {
        for operation_type in operation_types_nodes {
            let operation = operation_type.operation.as_str();
            let already_defined_operation_type = self.defined_operation_types.get(operation);

            if let Some(already_defined_operation_type) = already_defined_operation_type {
                self.context.report_error(GraphQLError::new(
                    format!("There can be only one {operation} type in schema."),
                    vec![already_defined_operation_type.loc, operation_type.loc],
                ));
            } else {
                self.defined_operation_types
                    .insert(operation, operation_type);
            }
        }

        VisitAction::Skip
    }
}
