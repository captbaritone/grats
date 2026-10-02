//! Port of graphql-js `validation/rules/UniqueFieldDefinitionNamesRule.ts`.

use rustc_hash::FxHashMap;

use crate::error::graphql_error::GraphQLError;
use crate::language::ast::NameNode;
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::validation::validation_context::SDLValidationContext;

/// Unique field definition names
///
/// A GraphQL complex type is only valid if all its fields are uniquely named.
///
/// PORT: There is no schema being extended (see `SDLValidationContext`), so no
/// fields already exist.
pub fn unique_field_definition_names_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    Box::new(UniqueFieldDefinitionNamesRule {
        context,
        known_field_names: FxHashMap::default(),
    })
}

struct UniqueFieldDefinitionNamesRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    known_field_names: FxHashMap<&'n str, FxHashMap<&'n str, &'n NameNode>>,
}

impl<'n> ASTVisitor<'n> for UniqueFieldDefinitionNamesRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        // PORT: graphql-js reads `node.fields`, which are field definitions
        // or input value definitions depending on the kind of node. Here the
        // names of the fields are passed, which is all that is read of them.
        fn names<T>(fields: &Option<Vec<T>>, name: fn(&T) -> &NameNode) -> Vec<&NameNode> {
            // FIXME: https://github.com/graphql/graphql-js/issues/2203
            fields.iter().flatten().map(name).collect()
        }
        match node {
            ASTNode::InputObjectTypeDefinition(node) => {
                self.check_field_uniqueness(&node.name, names(&node.fields, |f| &f.name))
            }
            ASTNode::InputObjectTypeExtension(node) => {
                self.check_field_uniqueness(&node.name, names(&node.fields, |f| &f.name))
            }
            ASTNode::InterfaceTypeDefinition(node) => {
                self.check_field_uniqueness(&node.name, names(&node.fields, |f| &f.name))
            }
            ASTNode::InterfaceTypeExtension(node) => {
                self.check_field_uniqueness(&node.name, names(&node.fields, |f| &f.name))
            }
            ASTNode::ObjectTypeDefinition(node) => {
                self.check_field_uniqueness(&node.name, names(&node.fields, |f| &f.name))
            }
            ASTNode::ObjectTypeExtension(node) => {
                self.check_field_uniqueness(&node.name, names(&node.fields, |f| &f.name))
            }
            _ => VisitAction::Continue,
        }
    }
}

impl<'n> UniqueFieldDefinitionNamesRule<'_, 'n> {
    fn check_field_uniqueness(
        &mut self,
        name: &'n NameNode,
        field_names_nodes: Vec<&'n NameNode>,
    ) -> VisitAction {
        let type_name = name.value.as_str();
        let field_names = self.known_field_names.entry(type_name).or_default();

        for field_name_node in field_names_nodes {
            let field_name = field_name_node.value.as_str();

            if let Some(known_field_name) = field_names.get(field_name) {
                self.context.report_error(GraphQLError::new(
                    format!("Field \"{type_name}.{field_name}\" can only be defined once."),
                    vec![known_field_name.loc, field_name_node.loc],
                ));
            } else {
                field_names.insert(field_name, field_name_node);
            }
        }

        VisitAction::Skip
    }
}
