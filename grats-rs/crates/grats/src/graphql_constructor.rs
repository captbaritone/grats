//! Port of `src/GraphQLConstructor.ts`.
//!
//! PORT: Only the parts used by ported code. The TypeScript class's methods
//! which don't create nodes located at TypeScript nodes are free functions.

use graphql_js::language::ast::{NullableTypeNode, TypeNode};

pub fn nullable_type(r#type: TypeNode) -> NullableTypeNode {
    let mut inner = r#type;
    loop {
        match inner {
            TypeNode::NonNullType(t) => inner = (*t.r#type).into(),
            TypeNode::NamedType(t) => return NullableTypeNode::NamedType(t),
            TypeNode::ListType(t) => return NullableTypeNode::ListType(t),
        }
    }
}
