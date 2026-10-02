use graphql_js::language::ast::DefinitionNode;
use rustc_hash::FxHashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InterfaceImplementorKind {
    Type,
    Interface,
}

#[derive(Debug, Clone)]
pub struct InterfaceImplementor {
    pub kind: InterfaceImplementorKind,
    pub name: String,
}

/// Each interface's implementors, in the order they're declared. A type which
/// declares an interface twice is listed twice.
#[derive(Default)]
pub struct InterfaceMap {
    map: FxHashMap<String, Vec<InterfaceImplementor>>,
}

impl InterfaceMap {
    pub fn get(&self, key: &str) -> &[InterfaceImplementor] {
        self.map.get(key).map_or(&[], Vec::as_slice)
    }
}

/// Compute a map of interfaces to the types and interfaces that implement them.
/// Expects type names to have been resolved.
pub fn compute_interface_map(docs: &[DefinitionNode]) -> InterfaceMap {
    let mut graph = InterfaceMap::default();
    for doc in docs {
        let (interfaces, kind, name) = match doc {
            DefinitionNode::InterfaceTypeDefinition(doc) => (
                &doc.interfaces,
                InterfaceImplementorKind::Interface,
                &doc.name,
            ),
            DefinitionNode::InterfaceTypeExtension(doc) => (
                &doc.interfaces,
                InterfaceImplementorKind::Interface,
                &doc.name,
            ),
            DefinitionNode::ObjectTypeDefinition(doc) => {
                (&doc.interfaces, InterfaceImplementorKind::Type, &doc.name)
            }
            DefinitionNode::ObjectTypeExtension(doc) => {
                (&doc.interfaces, InterfaceImplementorKind::Type, &doc.name)
            }
            _ => continue,
        };
        for interface in interfaces.iter().flatten() {
            graph
                .map
                .entry(interface.name.value.clone())
                .or_default()
                .push(InterfaceImplementor {
                    kind,
                    name: name.value.clone(),
                });
        }
    }
    graph
}
