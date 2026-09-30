//! Port of graphql-js `validation/rules/KnownTypeNamesRule.ts`.

use indexmap::IndexSet;

use crate::error::graphql_error::GraphQLError;
use crate::jsutils::did_you_mean::did_you_mean;
use crate::jsutils::suggestion_list::suggestion_list;
use crate::language::ast::DefinitionNode;
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::r#type::introspection::introspection_types;
use crate::r#type::scalars::specified_scalar_types;
use crate::validation::validation_context::SDLValidationContext;

/// Known type names
///
/// A GraphQL document is only valid if referenced types (specifically
/// variable definitions and fragment conditions) are defined by the type schema.
///
/// See https://spec.graphql.org/draft/#sec-Fragment-Spread-Type-Existence
///
/// PORT: There is no schema being extended (see `SDLValidationContext`), so no
/// types already exist.
pub fn known_type_names_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    let mut defined_types = IndexSet::new();
    for def in &context.get_document().definitions {
        if let Some(name) = type_definition_name(def) {
            defined_types.insert(name);
        }
    }

    Box::new(KnownTypeNamesRule {
        context,
        defined_types,
        standard_type_names: standard_type_names(),
    })
}

struct KnownTypeNamesRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    /// PORT: graphql-js maps the names to `true`. `typeNames`, their keys,
    /// is read from here.
    defined_types: IndexSet<&'n str>,
    standard_type_names: Vec<&'static str>,
}

impl<'n> ASTVisitor<'n> for KnownTypeNamesRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        let ASTNode::NamedType(node) = node else {
            return VisitAction::Continue;
        };
        let type_name = node.name.value.as_str();
        if !self.defined_types.contains(type_name) {
            // PORT: graphql-js checks whether the type is referenced within a
            // type system definition or extension, found at `ancestors[2]`.
            // Type system documents contain nothing else, so it always is.
            let is_sdl = true;
            if is_sdl && self.standard_type_names.contains(&type_name) {
                return VisitAction::Continue;
            }

            let suggested_types = suggestion_list(
                type_name,
                self.standard_type_names
                    .iter()
                    .copied()
                    .chain(self.defined_types.iter().copied()),
            );
            self.context.report_error(GraphQLError::new(
                format!("Unknown type \"{type_name}\".") + &did_you_mean(None, &suggested_types),
                vec![node.loc],
            ));
        }
        VisitAction::Continue
    }
}

/// PORT: graphql-js computes this once, as a module constant.
fn standard_type_names() -> Vec<&'static str> {
    specified_scalar_types()
        .iter()
        .map(|r#type| r#type.name)
        .chain(introspection_types().iter().map(|r#type| r#type.name()))
        .collect()
}

/// PORT: graphql-js checks `isTypeDefinitionNode(def)`, then reads
/// `def.name.value`.
fn type_definition_name(def: &DefinitionNode) -> Option<&str> {
    match def {
        DefinitionNode::ScalarTypeDefinition(def) => Some(&def.name.value),
        DefinitionNode::ObjectTypeDefinition(def) => Some(&def.name.value),
        DefinitionNode::InterfaceTypeDefinition(def) => Some(&def.name.value),
        DefinitionNode::UnionTypeDefinition(def) => Some(&def.name.value),
        DefinitionNode::EnumTypeDefinition(def) => Some(&def.name.value),
        DefinitionNode::InputObjectTypeDefinition(def) => Some(&def.name.value),
        _ => None,
    }
}
