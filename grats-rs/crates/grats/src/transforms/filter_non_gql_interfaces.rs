//! Port of `src/transforms/filterNonGqlInterfaces.ts`.

use graphql_js::language::ast::{DefinitionNode, NamedTypeNode};

use crate::type_context::TypeContext;

/// Filter out `implements` declarations that don't refer to a GraphQL interface.
/// Note: We depend upon traversal order here to ensure that we remove all
/// non-GraphQL interfaces before we try to resolve the names of the GraphQL
/// interfaces.
///
/// PORT: TypeScript returns copies of the definitions it filters. This filters
/// them in place.
pub fn filter_non_gql_interfaces(
    ctx: &TypeContext,
    mut definitions: Vec<DefinitionNode>,
) -> Vec<DefinitionNode> {
    for def in &mut definitions {
        match def {
            DefinitionNode::InterfaceTypeDefinition(def) => {
                filter_interfaces(ctx, &mut def.interfaces)
            }
            DefinitionNode::InterfaceTypeExtension(def) => {
                filter_interfaces(ctx, &mut def.interfaces)
            }
            DefinitionNode::ObjectTypeDefinition(def) => {
                filter_interfaces(ctx, &mut def.interfaces)
            }
            DefinitionNode::ObjectTypeExtension(def) => filter_interfaces(ctx, &mut def.interfaces),
            _ => {}
        }
    }
    definitions
}

/// PORT: Takes the definition's `interfaces`, which is all it reads.
fn filter_interfaces(ctx: &TypeContext, interfaces: &mut Option<Vec<NamedTypeNode>>) {
    let Some(interfaces) = interfaces else {
        return;
    };
    interfaces.retain(|i| ctx.unresolved_name_is_graphql(&i.name));
}
