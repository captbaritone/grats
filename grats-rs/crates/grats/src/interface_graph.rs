//! Port of `src/InterfaceGraph.ts`.

use std::collections::HashMap;

use graphql_js::language::ast::{DefinitionNode, NamedTypeNode};

use crate::type_context::TypeContext;

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

/// PORT: A `DefaultMap` of `Set`s in TypeScript. Each implementor added is a
/// new object, which a `Set` compares by identity, so the sets never dedupe and
/// a `Vec` behaves the same.
pub struct InterfaceMap {
    map: HashMap<String, Vec<InterfaceImplementor>>,
}

impl InterfaceMap {
    pub fn get(&self, key: &str) -> &[InterfaceImplementor] {
        self.map.get(key).map_or(&[], Vec::as_slice)
    }
}

/// Compute a map of interfaces to the types and interfaces that implement them.
pub fn compute_interface_map(type_context: &TypeContext, docs: &[DefinitionNode]) -> InterfaceMap {
    // For each interface definition, we need to know which types and interfaces implement it.
    let mut graph = InterfaceMap {
        map: HashMap::new(),
    };

    let mut add = |interface_name: String, implementor: InterfaceImplementor| {
        graph
            .map
            .entry(interface_name)
            .or_default()
            .push(implementor);
    };

    // PORT: The loop which each case of the TypeScript `switch` repeats.
    let mut add_all = |interfaces: &Option<Vec<NamedTypeNode>>,
                       kind: InterfaceImplementorKind,
                       name: &str| {
        for implementor in interfaces.iter().flatten() {
            let Ok(resolved) = type_context.resolve_unresolved_named_type(&implementor.name) else {
                // We trust that these errors will be reported elsewhere.
                continue;
            };
            add(
                resolved.value,
                InterfaceImplementor {
                    kind,
                    name: name.to_string(),
                },
            );
        }
    };

    for doc in docs {
        match doc {
            DefinitionNode::InterfaceTypeDefinition(doc) => {
                add_all(
                    &doc.interfaces,
                    InterfaceImplementorKind::Interface,
                    &doc.name.value,
                );
            }
            DefinitionNode::InterfaceTypeExtension(doc) => {
                add_all(
                    &doc.interfaces,
                    InterfaceImplementorKind::Interface,
                    &doc.name.value,
                );
            }
            DefinitionNode::ObjectTypeDefinition(doc) => {
                add_all(
                    &doc.interfaces,
                    InterfaceImplementorKind::Type,
                    &doc.name.value,
                );
            }
            DefinitionNode::ObjectTypeExtension(doc) => {
                add_all(
                    &doc.interfaces,
                    InterfaceImplementorKind::Type,
                    &doc.name.value,
                );
            }
            _ => {}
        }
    }

    graph
}
