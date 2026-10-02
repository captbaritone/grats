use graphql_js::language::ast::{DefinitionNode, DocumentNode};

/// Maps each of the document's top-level definitions, removing those for which
/// `mapper` returns `None`. Cheaper than a full visit of the document.
pub fn map_definitions(
    doc: DocumentNode,
    mapper: impl FnMut(DefinitionNode) -> Option<DefinitionNode>,
) -> DocumentNode {
    DocumentNode {
        definitions: doc.definitions.into_iter().filter_map(mapper).collect(),
        ..doc
    }
}
