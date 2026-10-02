use graphql_js::language::ast::DefinitionNode;

use crate::type_context::TypeContext;

/// Filter out `implements` declarations that don't refer to a GraphQL interface.
/// Note: We depend upon traversal order here to ensure that we remove all
/// non-GraphQL interfaces before we try to resolve the names of the GraphQL
/// interfaces.
pub fn filter_non_gql_interfaces(
    ctx: &TypeContext,
    mut definitions: Vec<DefinitionNode>,
) -> Vec<DefinitionNode> {
    for def in &mut definitions {
        let interfaces = match def {
            DefinitionNode::InterfaceTypeDefinition(def) => &mut def.interfaces,
            DefinitionNode::InterfaceTypeExtension(def) => &mut def.interfaces,
            DefinitionNode::ObjectTypeDefinition(def) => &mut def.interfaces,
            DefinitionNode::ObjectTypeExtension(def) => &mut def.interfaces,
            _ => continue,
        };
        if let Some(interfaces) = interfaces {
            interfaces.retain(|i| ctx.unresolved_name_is_graphql(&i.name));
        }
    }
    definitions
}
