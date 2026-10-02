//! Port of graphql-js `validation/rules/UniqueEnumValueNamesRule.ts`.

use rustc_hash::FxHashMap;

use crate::error::graphql_error::GraphQLError;
use crate::language::ast::{EnumValueDefinitionNode, NameNode};
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::validation::validation_context::SDLValidationContext;

/// Unique enum value names
///
/// A GraphQL enum type is only valid if all its values are uniquely named.
///
/// PORT: There is no schema being extended (see `SDLValidationContext`), so no
/// enum values already exist.
pub fn unique_enum_value_names_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    Box::new(UniqueEnumValueNamesRule {
        context,
        known_value_names: FxHashMap::default(),
    })
}

struct UniqueEnumValueNamesRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    known_value_names: FxHashMap<&'n str, FxHashMap<&'n str, &'n NameNode>>,
}

impl<'n> ASTVisitor<'n> for UniqueEnumValueNamesRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        match node {
            ASTNode::EnumTypeDefinition(node) => {
                self.check_value_uniqueness(&node.name, &node.values)
            }
            ASTNode::EnumTypeExtension(node) => {
                self.check_value_uniqueness(&node.name, &node.values)
            }
            _ => VisitAction::Continue,
        }
    }
}

impl<'n> UniqueEnumValueNamesRule<'_, 'n> {
    /// PORT: graphql-js passes the whole node, of which only the name and
    /// values are read.
    fn check_value_uniqueness(
        &mut self,
        name: &'n NameNode,
        values: &'n Option<Vec<EnumValueDefinitionNode>>,
    ) -> VisitAction {
        let type_name = name.value.as_str();
        let value_names = self.known_value_names.entry(type_name).or_default();

        // FIXME: https://github.com/graphql/graphql-js/issues/2203
        let value_nodes = values.as_deref().unwrap_or_default();

        for value_def in value_nodes {
            let value_name = value_def.name.value.as_str();

            if let Some(known_value_name) = value_names.get(value_name) {
                self.context.report_error(GraphQLError::new(
                    format!("Enum value \"{type_name}.{value_name}\" can only be defined once."),
                    vec![known_value_name.loc, value_def.name.loc],
                ));
            } else {
                value_names.insert(value_name, &value_def.name);
            }
        }

        VisitAction::Skip
    }
}
