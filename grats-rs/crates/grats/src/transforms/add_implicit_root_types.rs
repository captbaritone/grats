//! Port of `src/transforms/addImplicitRootTypes.ts`.

use std::collections::HashSet;

use graphql_js::language::ast::{
    DefinitionNode, DocumentNode, Location, NameNode, ObjectTypeDefinitionNode,
};
use indexmap::IndexMap;

use crate::extractor::OPERATION_TYPES;
use crate::utils::helpers::null_throws;
use crate::utils::visitor::visit_definitions;

/// Ensure any root types which have been extended with `@gqlQueryField` and
/// friends are defined in the schema.
///
/// If the type has been manually defined, it should not be created, but if it
/// has not, the type should be implicitly added to the schema AST.
pub fn add_implicit_root_types(mut doc: DocumentNode) -> DocumentNode {
    // PORT: An `IndexMap`, since a JavaScript `Map` iterates in insertion order.
    let mut extended_root_types: IndexMap<String, Location> = IndexMap::new();
    let mut defined_root_types: HashSet<String> = HashSet::new();
    visit_definitions(&doc, |def| match def {
        DefinitionNode::ObjectTypeExtension(ext)
            if OPERATION_TYPES.contains(&ext.name.value.as_str()) =>
        {
            extended_root_types.insert(ext.name.value.clone(), null_throws(ext.name.loc));
        }
        DefinitionNode::ObjectTypeDefinition(t)
            if OPERATION_TYPES.contains(&t.name.value.as_str()) =>
        {
            defined_root_types.insert(t.name.value.clone());
        }
        _ => {}
    });

    let mut root_types: Vec<DefinitionNode> = Vec::new();

    for (type_name, loc) in extended_root_types {
        if defined_root_types.contains(&type_name) {
            continue;
        }
        let name = NameNode {
            value: type_name,
            loc: Some(loc),
        };
        root_types.push(DefinitionNode::ObjectTypeDefinition(
            ObjectTypeDefinitionNode {
                loc: Some(loc),
                description: None,
                name,
                interfaces: None,
                directives: None,
                fields: None,
                was_synthesized: false,
                has_type_name_field: false,
                exported: None,
            },
        ));
    }
    if root_types.is_empty() {
        return doc;
    }
    doc.definitions.extend(root_types);
    doc
}
