use graphql_js::language::ast::{DefinitionNode, DocumentNode, FieldDefinitionNode};
use rustc_hash::FxHashMap;

use crate::utils::visitor::map_definitions;

/// Takes every example of `extend type Foo` and `extend interface Foo` and
/// merges them into the original type/interface definition.
pub fn merge_extensions(doc: DocumentNode) -> DocumentNode {
    let mut fields: FxHashMap<String, Vec<FieldDefinitionNode>> = FxHashMap::default();

    // Collect all the fields from the extensions and trim them from the AST.
    let sans_extensions = map_definitions(doc, |def| {
        let (name, directives, interfaces, extension_fields) = match def {
            DefinitionNode::ObjectTypeExtension(t) => {
                (t.name, t.directives, t.interfaces, t.fields)
            }
            DefinitionNode::InterfaceTypeExtension(t) => {
                (t.name, t.directives, t.interfaces, t.fields)
            }
            // Grats does not create these extension types
            DefinitionNode::ScalarTypeExtension(_) => panic!("Unexpected ScalarTypeExtension"),
            DefinitionNode::EnumTypeExtension(_) => panic!("Unexpected EnumTypeExtension"),
            DefinitionNode::SchemaExtension(_) => panic!("Unexpected SchemaExtension"),
            def => return Some(def),
        };
        assert!(
            directives.is_none() && interfaces.is_none(),
            "Unexpected directives or interfaces on Extension"
        );
        fields
            .entry(name.value)
            .or_default()
            .extend(extension_fields.into_iter().flatten());
        None
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

/// Adds the extensions' fields to a definition's. They're cloned, since more
/// than one definition may share a name.
fn merge_fields(
    fields: &mut Option<Vec<FieldDefinitionNode>>,
    extensions: Option<&Vec<FieldDefinitionNode>>,
) {
    if let Some(extensions) = extensions.filter(|extensions| !extensions.is_empty()) {
        fields.get_or_insert_default().extend_from_slice(extensions);
    }
}
