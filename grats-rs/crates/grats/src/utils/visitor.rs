//! Port of `src/utils/visitor.ts`.

use graphql_js::language::ast::{DefinitionNode, DocumentNode};

/// Simplified, more performant, version of graphql-js's visit function that only
/// visits the top-level definitions in a DocumentNode.
///
/// PORT: The TypeScript version takes a mapper per definition kind. Here a
/// single function receives every definition and matches on its kind. Returning
/// `None` removes the definition.
pub fn map_definitions(
    doc: DocumentNode,
    mut visitor: impl FnMut(DefinitionNode) -> Option<DefinitionNode>,
) -> DocumentNode {
    DocumentNode {
        definitions: doc
            .definitions
            .into_iter()
            .filter_map(&mut visitor)
            .collect(),
        ..doc
    }
}
