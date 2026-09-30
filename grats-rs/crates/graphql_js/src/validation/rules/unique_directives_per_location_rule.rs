//! Port of graphql-js `validation/rules/UniqueDirectivesPerLocationRule.ts`.

use std::collections::HashMap;

use crate::error::graphql_error::GraphQLError;
use crate::language::ast::{ConstDirectiveNode, DefinitionNode};
use crate::language::predicates::{is_type_definition_node, is_type_extension_node};
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::r#type::directives::specified_directives;
use crate::validation::validation_context::SDLValidationContext;

/// Unique directive names per location
///
/// A GraphQL document is only valid if all non-repeatable directives at
/// a given location are uniquely named.
///
/// See https://spec.graphql.org/draft/#sec-Directives-Are-Unique-Per-Location
///
/// PORT: There is no schema being extended (see `SDLValidationContext`), so
/// the defined directives are the specified directives.
pub fn unique_directives_per_location_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    let mut unique_directive_map: HashMap<&'n str, bool> = HashMap::new();

    let defined_directives = specified_directives();
    for directive in defined_directives {
        unique_directive_map.insert(directive.name, !directive.is_repeatable);
    }

    let ast_definitions = &context.get_document().definitions;
    for def in ast_definitions {
        if let DefinitionNode::DirectiveDefinition(def) = def {
            unique_directive_map.insert(&def.name.value, !def.repeatable);
        }
    }

    Box::new(UniqueDirectivesPerLocationRule {
        context,
        unique_directive_map,
        schema_directives: HashMap::new(),
        type_directives_map: HashMap::new(),
    })
}

type SeenDirectives<'n> = HashMap<&'n str, &'n ConstDirectiveNode>;

struct UniqueDirectivesPerLocationRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    unique_directive_map: HashMap<&'n str, bool>,
    schema_directives: SeenDirectives<'n>,
    type_directives_map: HashMap<&'n str, SeenDirectives<'n>>,
}

impl<'n> ASTVisitor<'n> for UniqueDirectivesPerLocationRule<'_, 'n> {
    // Many different AST nodes may contain directives. Rather than listing
    // them all, just listen for entering any node, and check to see if it
    // defines any directives.
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        let Some(Some(directives)) = directives(node) else {
            return VisitAction::Continue;
        };

        let mut new_seen_directives = HashMap::new();
        let seen_directives = if matches!(
            node,
            ASTNode::SchemaDefinition(_) | ASTNode::SchemaExtension(_)
        ) {
            &mut self.schema_directives
        } else if is_type_definition_node(node) || is_type_extension_node(node) {
            let type_name = type_name(node);
            self.type_directives_map.entry(type_name).or_default()
        } else {
            &mut new_seen_directives
        };

        for directive in directives {
            let directive_name = directive.name.value.as_str();

            if self.unique_directive_map.get(directive_name) == Some(&true) {
                if let Some(seen_directive) = seen_directives.get(directive_name) {
                    self.context.report_error(GraphQLError::new(
                        format!(
                            "The directive \"@{directive_name}\" can only be used once at this location."
                        ),
                        vec![seen_directive.loc, directive.loc],
                    ));
                } else {
                    seen_directives.insert(directive_name, directive);
                }
            }
        }
        VisitAction::Continue
    }
}

/// PORT: graphql-js checks `'directives' in node`, then reads
/// `node.directives`.
fn directives<'n>(node: ASTNode<'n>) -> Option<&'n Option<Vec<ConstDirectiveNode>>> {
    match node {
        ASTNode::SchemaDefinition(node) => Some(&node.directives),
        ASTNode::ScalarTypeDefinition(node) => Some(&node.directives),
        ASTNode::ObjectTypeDefinition(node) => Some(&node.directives),
        ASTNode::FieldDefinition(node) => Some(&node.directives),
        ASTNode::InputValueDefinition(node) => Some(&node.directives),
        ASTNode::InterfaceTypeDefinition(node) => Some(&node.directives),
        ASTNode::UnionTypeDefinition(node) => Some(&node.directives),
        ASTNode::EnumTypeDefinition(node) => Some(&node.directives),
        ASTNode::EnumValueDefinition(node) => Some(&node.directives),
        ASTNode::InputObjectTypeDefinition(node) => Some(&node.directives),
        ASTNode::SchemaExtension(node) => Some(&node.directives),
        ASTNode::ScalarTypeExtension(node) => Some(&node.directives),
        ASTNode::ObjectTypeExtension(node) => Some(&node.directives),
        ASTNode::InterfaceTypeExtension(node) => Some(&node.directives),
        ASTNode::UnionTypeExtension(node) => Some(&node.directives),
        ASTNode::EnumTypeExtension(node) => Some(&node.directives),
        ASTNode::InputObjectTypeExtension(node) => Some(&node.directives),
        _ => None,
    }
}

/// PORT: `node.name.value`, for a type definition or extension node.
fn type_name<'n>(node: ASTNode<'n>) -> &'n str {
    match node {
        ASTNode::ScalarTypeDefinition(node) => &node.name.value,
        ASTNode::ObjectTypeDefinition(node) => &node.name.value,
        ASTNode::InterfaceTypeDefinition(node) => &node.name.value,
        ASTNode::UnionTypeDefinition(node) => &node.name.value,
        ASTNode::EnumTypeDefinition(node) => &node.name.value,
        ASTNode::InputObjectTypeDefinition(node) => &node.name.value,
        ASTNode::ScalarTypeExtension(node) => &node.name.value,
        ASTNode::ObjectTypeExtension(node) => &node.name.value,
        ASTNode::InterfaceTypeExtension(node) => &node.name.value,
        ASTNode::UnionTypeExtension(node) => &node.name.value,
        ASTNode::EnumTypeExtension(node) => &node.name.value,
        ASTNode::InputObjectTypeExtension(node) => &node.name.value,
        _ => unreachable!("Expected a type definition or extension node"),
    }
}
