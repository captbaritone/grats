//! Port of graphql-js `language/predicates.ts`.
//!
//! PORT: Only the predicates which ported code uses.

use crate::language::visitor::ASTNode;

pub fn is_type_definition_node(node: ASTNode) -> bool {
    matches!(
        node,
        ASTNode::ScalarTypeDefinition(_)
            | ASTNode::ObjectTypeDefinition(_)
            | ASTNode::InterfaceTypeDefinition(_)
            | ASTNode::UnionTypeDefinition(_)
            | ASTNode::EnumTypeDefinition(_)
            | ASTNode::InputObjectTypeDefinition(_)
    )
}

pub fn is_type_extension_node(node: ASTNode) -> bool {
    matches!(
        node,
        ASTNode::ScalarTypeExtension(_)
            | ASTNode::ObjectTypeExtension(_)
            | ASTNode::InterfaceTypeExtension(_)
            | ASTNode::UnionTypeExtension(_)
            | ASTNode::EnumTypeExtension(_)
            | ASTNode::InputObjectTypeExtension(_)
    )
}
