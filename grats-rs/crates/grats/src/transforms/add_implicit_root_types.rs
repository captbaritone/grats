use std::collections::HashSet;

use graphql_js::language::ast::{
    DefinitionNode, DocumentNode, Location, NameNode, ObjectTypeDefinitionNode, UNTRACKED_ID,
};
use indexmap::IndexMap;

use crate::extractor::OPERATION_TYPES;

/// Ensure any root types which have been extended with `@gqlQueryField` and
/// friends are defined in the schema.
///
/// If the type has been manually defined, it should not be created, but if it
/// has not, the type should be implicitly added to the schema AST.
pub fn add_implicit_root_types(mut doc: DocumentNode) -> DocumentNode {
    // Each extended root type, in the order it's first extended, with the
    // location of its last extension.
    let mut extended_root_types: IndexMap<String, Location> = IndexMap::new();
    let mut defined_root_types: HashSet<String> = HashSet::new();
    for def in &doc.definitions {
        match def {
            DefinitionNode::ObjectTypeExtension(ext)
                if OPERATION_TYPES.contains(&ext.name.value.as_str()) =>
            {
                let loc = ext.name.loc.expect("Expected name to have loc");
                extended_root_types.insert(ext.name.value.clone(), loc);
            }
            DefinitionNode::ObjectTypeDefinition(t)
                if OPERATION_TYPES.contains(&t.name.value.as_str()) =>
            {
                defined_root_types.insert(t.name.value.clone());
            }
            _ => {}
        }
    }

    let root_types = extended_root_types
        .into_iter()
        .filter(|(type_name, _)| !defined_root_types.contains(type_name))
        .map(|(type_name, loc)| {
            DefinitionNode::ObjectTypeDefinition(ObjectTypeDefinitionNode {
                loc: Some(loc),
                description: None,
                name: NameNode {
                    value: type_name,
                    ts_identifier: UNTRACKED_ID,
                    loc: Some(loc),
                },
                interfaces: None,
                directives: None,
                fields: None,
                was_synthesized: false,
                has_type_name_field: false,
                exported: None,
            })
        });
    doc.definitions.extend(root_types);
    doc
}
