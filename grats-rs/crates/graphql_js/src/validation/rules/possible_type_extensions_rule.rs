//! Port of graphql-js `validation/rules/PossibleTypeExtensionsRule.ts`.

use indexmap::IndexMap;

use crate::error::graphql_error::GraphQLError;
use crate::jsutils::did_you_mean::did_you_mean;
use crate::jsutils::suggestion_list::suggestion_list;
use crate::language::ast::{DefinitionNode, NameNode};
use crate::language::visitor::{ASTNode, ASTVisitor, VisitAction};
use crate::validation::validation_context::SDLValidationContext;

/// Possible type extension
///
/// A type extension is only valid if the type is defined and has the same kind.
///
/// PORT: There is no schema being extended (see `SDLValidationContext`), so no
/// types already exist.
pub fn possible_type_extensions_rule<'c, 'n>(
    context: &'c SDLValidationContext<'n>,
) -> Box<dyn ASTVisitor<'n> + 'c> {
    let mut defined_types = IndexMap::new();
    for def in &context.get_document().definitions {
        if let Some((name, kind)) = def_kind_to_ext_kind(def) {
            defined_types.insert(name.value.as_str(), (def, kind));
        }
    }

    Box::new(PossibleTypeExtensionsRule {
        context,
        defined_types,
    })
}

/// PORT: graphql-js compares `Kind` strings. Here type definitions and
/// extensions are compared by the kind of type they define or extend.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TypeKind {
    Scalar,
    Object,
    Interface,
    Union,
    Enum,
    InputObject,
}

struct PossibleTypeExtensionsRule<'c, 'n> {
    context: &'c SDLValidationContext<'n>,
    /// PORT: graphql-js maps each name to its definition, whose extension kind
    /// it looks up in `defKindToExtKind`. Here the kind is stored with it.
    defined_types: IndexMap<&'n str, (&'n DefinitionNode, TypeKind)>,
}

impl<'n> ASTVisitor<'n> for PossibleTypeExtensionsRule<'_, 'n> {
    fn enter(&mut self, node: ASTNode<'n>) -> VisitAction {
        match node {
            ASTNode::ScalarTypeExtension(ext) => {
                self.check_extension(node, &ext.name, TypeKind::Scalar)
            }
            ASTNode::ObjectTypeExtension(ext) => {
                self.check_extension(node, &ext.name, TypeKind::Object)
            }
            ASTNode::InterfaceTypeExtension(ext) => {
                self.check_extension(node, &ext.name, TypeKind::Interface)
            }
            ASTNode::UnionTypeExtension(ext) => {
                self.check_extension(node, &ext.name, TypeKind::Union)
            }
            ASTNode::EnumTypeExtension(ext) => {
                self.check_extension(node, &ext.name, TypeKind::Enum)
            }
            ASTNode::InputObjectTypeExtension(ext) => {
                self.check_extension(node, &ext.name, TypeKind::InputObject)
            }
            _ => {}
        }
        VisitAction::Continue
    }
}

impl PossibleTypeExtensionsRule<'_, '_> {
    /// PORT: graphql-js passes the node, and reads its name and kind from it.
    fn check_extension(&self, node: ASTNode, name: &NameNode, kind: TypeKind) {
        let type_name = name.value.as_str();
        let def_node = self.defined_types.get(type_name);

        if let Some(&(def_node, expected_kind)) = def_node {
            if expected_kind != kind {
                let kind_str = extension_kind_to_type_name(kind);
                self.context.report_error(GraphQLError::new(
                    format!("Cannot extend non-{kind_str} type \"{type_name}\"."),
                    vec![ASTNode::from(def_node).loc(), node.loc()],
                ));
            }
        } else {
            let all_type_names = self.defined_types.keys().copied();
            let suggested_types = suggestion_list(type_name, all_type_names);
            self.context.report_error(GraphQLError::new(
                format!("Cannot extend type \"{type_name}\" because it is not defined.")
                    + &did_you_mean(None, &suggested_types),
                vec![name.loc],
            ));
        }
    }
}

/// PORT: graphql-js's `defKindToExtKind`, applied to a definition which
/// `isTypeDefinitionNode`. Also returns the definition's name, which graphql-js
/// reads from it.
fn def_kind_to_ext_kind(def: &DefinitionNode) -> Option<(&NameNode, TypeKind)> {
    match def {
        DefinitionNode::ScalarTypeDefinition(def) => Some((&def.name, TypeKind::Scalar)),
        DefinitionNode::ObjectTypeDefinition(def) => Some((&def.name, TypeKind::Object)),
        DefinitionNode::InterfaceTypeDefinition(def) => Some((&def.name, TypeKind::Interface)),
        DefinitionNode::UnionTypeDefinition(def) => Some((&def.name, TypeKind::Union)),
        DefinitionNode::EnumTypeDefinition(def) => Some((&def.name, TypeKind::Enum)),
        DefinitionNode::InputObjectTypeDefinition(def) => Some((&def.name, TypeKind::InputObject)),
        _ => None,
    }
}

fn extension_kind_to_type_name(kind: TypeKind) -> &'static str {
    match kind {
        TypeKind::Scalar => "scalar",
        TypeKind::Object => "object",
        TypeKind::Interface => "interface",
        TypeKind::Union => "union",
        TypeKind::Enum => "enum",
        TypeKind::InputObject => "input object",
    }
}
