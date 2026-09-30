//! Port of `src/transforms/mergeExtensions.ts`.

use std::collections::HashMap;
use std::hash::Hash;

use graphql_js::language::ast::{DefinitionNode, DocumentNode, FieldDefinitionNode};

use crate::utils::visitor::map_definitions;

/// Takes every example of `extend type Foo` and `extend interface Foo` and
/// merges them into the original type/interface definition.
pub fn merge_extensions(doc: DocumentNode) -> DocumentNode {
    let mut fields: MultiMap<String, FieldDefinitionNode> = MultiMap::new();

    // Collect all the fields from the extensions and trim them from the AST.
    let sans_extensions = map_definitions(doc, |def| match def {
        DefinitionNode::ObjectTypeExtension(t) => {
            if t.directives.is_some() || t.interfaces.is_some() {
                panic!("Unexpected directives or interfaces on Extension");
            }
            fields.extend(t.name.value, t.fields);
            None
        }
        DefinitionNode::InterfaceTypeExtension(t) => {
            if t.directives.is_some() || t.interfaces.is_some() {
                panic!("Unexpected directives or interfaces on Extension");
            }
            fields.extend(t.name.value, t.fields);
            None
        }
        // Grats does not create these extension types
        DefinitionNode::ScalarTypeExtension(_) => panic!("Unexpected ScalarTypeExtension"),
        DefinitionNode::EnumTypeExtension(_) => panic!("Unexpected EnumTypeExtension"),
        DefinitionNode::SchemaExtension(_) => panic!("Unexpected SchemaExtension"),
        def => Some(def),
    });

    // Merge collected extension fields into the original type/interface definition.
    map_definitions(sans_extensions, |def| match def {
        DefinitionNode::ObjectTypeDefinition(mut t) => {
            merge_fields(&mut t.fields, fields.get(&t.name.value));
            Some(DefinitionNode::ObjectTypeDefinition(t))
        }
        DefinitionNode::InterfaceTypeDefinition(mut t) => {
            merge_fields(&mut t.fields, fields.get(&t.name.value));
            Some(DefinitionNode::InterfaceTypeDefinition(t))
        }
        def => Some(def),
    })
}

/// PORT: The part of the TypeScript mappers which object types and interfaces
/// share. Extensions are cloned, since more than one definition may share a
/// name.
fn merge_fields(fields: &mut Option<Vec<FieldDefinitionNode>>, extensions: &[FieldDefinitionNode]) {
    if extensions.is_empty() {
        return;
    }
    match fields {
        None => *fields = Some(extensions.to_vec()),
        Some(fields) => fields.extend_from_slice(extensions),
    }
}

// Map a key to an array of values.
//
// PORT: `push` is unused, so it isn't ported.
struct MultiMap<K, V> {
    map: HashMap<K, Vec<V>>,
}

impl<K: Eq + Hash, V> MultiMap<K, V> {
    fn new() -> Self {
        MultiMap {
            map: HashMap::new(),
        }
    }

    fn extend(&mut self, key: K, values: Option<Vec<V>>) {
        let Some(values) = values else {
            return;
        };
        self.map.entry(key).or_default().extend(values);
    }

    fn get(&self, key: &K) -> &[V] {
        self.map.get(key).map_or(&[], Vec::as_slice)
    }
}
