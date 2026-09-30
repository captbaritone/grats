//! Port of graphql-js `validation/rules/KnownDirectivesRule.ts`.

use std::collections::HashMap;

use crate::error::graphql_error::GraphQLError;
use crate::language::ast::{ConstDirectiveNode, DefinitionNode};
use crate::language::directive_location;
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::r#type::directives::specified_directives;
use crate::validation::validation_context::SDLValidationContext;

/// Known directives
///
/// A GraphQL document is only valid if all `@directives` are known by the
/// schema and legally positioned.
///
/// See https://spec.graphql.org/draft/#sec-Directives-Are-Defined
///
/// PORT: There is no schema being extended (see `SDLValidationContext`), so
/// the defined directives are the specified directives.
pub fn known_directives_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    let mut locations_map: HashMap<&'n str, Vec<&'n str>> = HashMap::new();

    let defined_directives = specified_directives();
    for directive in defined_directives {
        locations_map.insert(directive.name, directive.locations.clone());
    }

    let ast_definitions = &context.get_document().definitions;
    for def in ast_definitions {
        if let DefinitionNode::DirectiveDefinition(def) = def {
            locations_map.insert(
                &def.name.value,
                def.locations
                    .iter()
                    .map(|name| name.value.as_str())
                    .collect(),
            );
        }
    }

    Box::new(KnownDirectivesRule {
        context,
        locations_map,
        ancestors: Vec::new(),
    })
}

struct KnownDirectivesRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    locations_map: HashMap<&'n str, Vec<&'n str>>,
    /// PORT: graphql-js visitors are passed the ancestors of the node being
    /// visited. Here the rule tracks them itself. graphql-js ancestors also
    /// include the arrays which hold nodes, which aren't tracked.
    ancestors: Vec<ASTNode<'n>>,
}

impl<'n> ASTVisitor<'n> for KnownDirectivesRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        if let ASTNode::Directive(node) = node {
            self.check_directive(node);
        }
        self.ancestors.push(node);
        VisitAction::Continue
    }

    fn leave(&mut self, _node: ASTNode<'n>) {
        self.ancestors.pop();
    }
}

impl KnownDirectivesRule<'_, '_> {
    fn check_directive(&self, node: &ConstDirectiveNode) {
        let name = node.name.value.as_str();
        let Some(locations) = self.locations_map.get(name) else {
            self.context.report_error(GraphQLError::new(
                format!("Unknown directive \"@{name}\"."),
                vec![node.loc],
            ));
            return;
        };

        let candidate_location = get_directive_location_for_ast_path(&self.ancestors);
        if !locations.contains(&candidate_location) {
            self.context.report_error(GraphQLError::new(
                format!("Directive \"@{name}\" may not be used on {candidate_location}."),
                vec![node.loc],
            ));
        }
    }
}

/// PORT: Only type system nodes are visited (see `ast.rs`), so there is always
/// a candidate location.
fn get_directive_location_for_ast_path(ancestors: &[ASTNode]) -> &'static str {
    let applied_to = ancestors[ancestors.len() - 1];
    match applied_to {
        ASTNode::SchemaDefinition(_) | ASTNode::SchemaExtension(_) => directive_location::SCHEMA,
        ASTNode::ScalarTypeDefinition(_) | ASTNode::ScalarTypeExtension(_) => {
            directive_location::SCALAR
        }
        ASTNode::ObjectTypeDefinition(_) | ASTNode::ObjectTypeExtension(_) => {
            directive_location::OBJECT
        }
        ASTNode::FieldDefinition(_) => directive_location::FIELD_DEFINITION,
        ASTNode::InterfaceTypeDefinition(_) | ASTNode::InterfaceTypeExtension(_) => {
            directive_location::INTERFACE
        }
        ASTNode::UnionTypeDefinition(_) | ASTNode::UnionTypeExtension(_) => {
            directive_location::UNION
        }
        ASTNode::EnumTypeDefinition(_) | ASTNode::EnumTypeExtension(_) => directive_location::ENUM,
        ASTNode::EnumValueDefinition(_) => directive_location::ENUM_VALUE,
        ASTNode::InputObjectTypeDefinition(_) | ASTNode::InputObjectTypeExtension(_) => {
            directive_location::INPUT_OBJECT
        }
        ASTNode::InputValueDefinition(_) => {
            // PORT: graphql-js reads `ancestors[ancestors.length - 3]`, which
            // skips the array holding the input value definition.
            let parent_node = ancestors[ancestors.len() - 2];
            if matches!(parent_node, ASTNode::InputObjectTypeDefinition(_)) {
                directive_location::INPUT_FIELD_DEFINITION
            } else {
                directive_location::ARGUMENT_DEFINITION
            }
        }
        // Not reachable, all possible types have been considered.
        _ => unreachable!("Unexpected kind: {applied_to:?}"),
    }
}
