//! Port of graphql-js `type/schema.ts`.

use std::collections::HashMap;
use std::ops::Index;

use indexmap::IndexMap;

use crate::language::ast::{OperationTypeNode, SchemaDefinitionNode, SchemaExtensionNode};
use crate::r#type::definition::{GraphQLField, GraphQLNamedType, TypeArena, TypeId};
use crate::r#type::directives::{GraphQLDirective, specified_directives};
use crate::r#type::introspection::__SCHEMA;

/// Schema Definition
///
/// A Schema is created by supplying the root types of each type of operation,
/// query and mutation (optional). A schema definition is then supplied to the
/// validator and executor.
///
/// PORT: The schema owns the `TypeArena` holding its named types. Index the
/// schema with a `TypeId` to get a named type.
#[derive(Debug)]
pub struct GraphQLSchema<'a> {
    pub description: Option<&'a str>,
    pub ast_node: Option<&'a SchemaDefinitionNode>,
    pub extension_ast_nodes: Vec<&'a SchemaExtensionNode>,

    arena: TypeArena<'a>,
    query_type: Option<TypeId>,
    mutation_type: Option<TypeId>,
    subscription_type: Option<TypeId>,
    directives: Vec<GraphQLDirective<'a>>,
    type_map: IndexMap<&'a str, TypeId>,
    implementations_map: HashMap<&'a str, InterfaceImplementations>,
}

#[derive(Debug, Default)]
pub struct InterfaceImplementations {
    pub objects: Vec<TypeId>,
    pub interfaces: Vec<TypeId>,
}

static NO_IMPLEMENTATIONS: InterfaceImplementations = InterfaceImplementations {
    objects: Vec::new(),
    interfaces: Vec::new(),
};

/// PORT: graphql-js passes type objects. Here the types are ids into `arena`,
/// which moves into the schema.
#[derive(Debug)]
pub struct GraphQLSchemaConfig<'a> {
    pub description: Option<&'a str>,
    pub query: Option<TypeId>,
    pub mutation: Option<TypeId>,
    pub subscription: Option<TypeId>,
    pub types: Vec<TypeId>,
    pub directives: Option<Vec<GraphQLDirective<'a>>>,
    pub ast_node: Option<&'a SchemaDefinitionNode>,
    pub extension_ast_nodes: Vec<&'a SchemaExtensionNode>,
    pub arena: TypeArena<'a>,
}

impl<'a> GraphQLSchema<'a> {
    pub fn new(config: GraphQLSchemaConfig<'a>) -> Self {
        let arena = config.arena;
        // Provide specified directives (e.g. @include and @skip) by default.
        let directives = config
            .directives
            .unwrap_or_else(|| specified_directives().into_iter().cloned().collect());

        // To preserve order of user-provided types, we add first to add them to
        // the set of "collected" types, so `collectReferencedTypes` ignore them.
        let mut all_referenced_types = TypeSet::new(&config.types);
        for &r#type in &config.types {
            // When we ready to process this type, we remove it from "collected" types
            // and then add it together with all dependent types in the correct position.
            all_referenced_types.delete(r#type);
            collect_referenced_types(r#type, &mut all_referenced_types, &arena);
        }

        if let Some(query_type) = config.query {
            collect_referenced_types(query_type, &mut all_referenced_types, &arena);
        }
        if let Some(mutation_type) = config.mutation {
            collect_referenced_types(mutation_type, &mut all_referenced_types, &arena);
        }
        if let Some(subscription_type) = config.subscription {
            collect_referenced_types(subscription_type, &mut all_referenced_types, &arena);
        }

        for directive in &directives {
            for arg in &directive.args {
                collect_referenced_types(
                    arg.r#type.get_named_type(),
                    &mut all_referenced_types,
                    &arena,
                );
            }
        }

        collect_referenced_types(__SCHEMA, &mut all_referenced_types, &arena);

        // Storing the resulting map for reference by the schema.
        let mut type_map: IndexMap<&'a str, TypeId> = IndexMap::new();
        // Keep track of all implementations by interface name.
        let mut implementations_map: HashMap<&'a str, InterfaceImplementations> = HashMap::new();

        for named_type in all_referenced_types.iter() {
            let type_name = arena[named_type].name();
            if type_map.contains_key(type_name) {
                panic!(
                    "Schema must contain uniquely named types but contains multiple types named \"{type_name}\"."
                );
            }
            type_map.insert(type_name, named_type);

            match &arena[named_type] {
                GraphQLNamedType::Interface(interface_type) => {
                    // Store implementations by interface.
                    for &iface in interface_type.get_interfaces() {
                        if let GraphQLNamedType::Interface(iface) = &arena[iface] {
                            implementations_map
                                .entry(iface.name)
                                .or_default()
                                .interfaces
                                .push(named_type);
                        }
                    }
                }
                GraphQLNamedType::Object(object_type) => {
                    // Store implementations by objects.
                    for &iface in object_type.get_interfaces() {
                        if let GraphQLNamedType::Interface(iface) = &arena[iface] {
                            implementations_map
                                .entry(iface.name)
                                .or_default()
                                .objects
                                .push(named_type);
                        }
                    }
                }
                _ => {}
            }
        }

        GraphQLSchema {
            description: config.description,
            ast_node: config.ast_node,
            extension_ast_nodes: config.extension_ast_nodes,
            arena,
            query_type: config.query,
            mutation_type: config.mutation,
            subscription_type: config.subscription,
            directives,
            type_map,
            implementations_map,
        }
    }

    /// PORT: Not in graphql-js, where types are objects. Functions that read
    /// types by id, like `valueFromAST`, take the arena.
    pub fn arena(&self) -> &TypeArena<'a> {
        &self.arena
    }

    pub fn get_query_type(&self) -> Option<TypeId> {
        self.query_type
    }

    pub fn get_mutation_type(&self) -> Option<TypeId> {
        self.mutation_type
    }

    pub fn get_subscription_type(&self) -> Option<TypeId> {
        self.subscription_type
    }

    pub fn get_root_type(&self, operation: OperationTypeNode) -> Option<TypeId> {
        match operation {
            OperationTypeNode::Query => self.get_query_type(),
            OperationTypeNode::Mutation => self.get_mutation_type(),
            OperationTypeNode::Subscription => self.get_subscription_type(),
        }
    }

    pub fn get_type_map(&self) -> &IndexMap<&'a str, TypeId> {
        &self.type_map
    }

    pub fn get_type(&self, name: &str) -> Option<TypeId> {
        self.type_map.get(name).copied()
    }

    pub fn get_possible_types(&self, abstract_type: TypeId) -> &[TypeId] {
        match &self[abstract_type] {
            GraphQLNamedType::Union(union_type) => union_type.get_types(),
            _ => &self.get_implementations(abstract_type).objects,
        }
    }

    pub fn get_implementations(&self, interface_type: TypeId) -> &InterfaceImplementations {
        self.implementations_map
            .get(self[interface_type].name())
            .unwrap_or(&NO_IMPLEMENTATIONS)
    }

    /// PORT: graphql-js caches a set of subtype names per abstract type. This
    /// searches the same lists directly.
    pub fn is_sub_type(&self, abstract_type: TypeId, maybe_sub_type: TypeId) -> bool {
        let name = self[maybe_sub_type].name();
        let has_name = |types: &[TypeId]| types.iter().any(|&r#type| self[r#type].name() == name);
        match &self[abstract_type] {
            GraphQLNamedType::Union(union_type) => has_name(union_type.get_types()),
            _ => {
                let implementations = self.get_implementations(abstract_type);
                has_name(&implementations.objects) || has_name(&implementations.interfaces)
            }
        }
    }

    pub fn get_directives(&self) -> &[GraphQLDirective<'a>] {
        &self.directives
    }

    pub fn get_directive(&self, name: &str) -> Option<&GraphQLDirective<'a>> {
        self.get_directives()
            .iter()
            .find(|directive| directive.name == name)
    }
}

impl<'a> Index<TypeId> for GraphQLSchema<'a> {
    type Output = GraphQLNamedType<'a>;

    fn index(&self, id: TypeId) -> &Self::Output {
        &self.arena[id]
    }
}

/// PORT: graphql-js collects types in a JavaScript `Set`, which iterates in
/// insertion order and moves a deleted and re-added value to the end. Deleting
/// from an `IndexSet` in the middle is linear, so this leaves a tombstone.
struct TypeSet {
    entries: Vec<Option<TypeId>>,
    positions: HashMap<TypeId, usize>,
}

impl TypeSet {
    fn new(types: &[TypeId]) -> Self {
        let mut set = TypeSet {
            entries: Vec::new(),
            positions: HashMap::new(),
        };
        for &r#type in types {
            set.add(r#type);
        }
        set
    }

    fn has(&self, r#type: TypeId) -> bool {
        self.positions.contains_key(&r#type)
    }

    fn add(&mut self, r#type: TypeId) {
        if !self.has(r#type) {
            self.positions.insert(r#type, self.entries.len());
            self.entries.push(Some(r#type));
        }
    }

    fn delete(&mut self, r#type: TypeId) {
        if let Some(position) = self.positions.remove(&r#type) {
            self.entries[position] = None;
        }
    }

    fn iter(&self) -> impl Iterator<Item = TypeId> + '_ {
        self.entries.iter().flatten().copied()
    }
}

/// PORT: graphql-js accepts any type and unwraps it to its named type.
fn collect_referenced_types(named_type: TypeId, type_set: &mut TypeSet, arena: &TypeArena) {
    if !type_set.has(named_type) {
        type_set.add(named_type);

        match &arena[named_type] {
            GraphQLNamedType::Union(union_type) => {
                for &member_type in union_type.get_types() {
                    collect_referenced_types(member_type, type_set, arena);
                }
            }
            GraphQLNamedType::Object(object_type) => {
                collect_object_or_interface_types(
                    object_type.get_interfaces(),
                    object_type.get_fields(),
                    type_set,
                    arena,
                );
            }
            GraphQLNamedType::Interface(interface_type) => {
                collect_object_or_interface_types(
                    interface_type.get_interfaces(),
                    interface_type.get_fields(),
                    type_set,
                    arena,
                );
            }
            GraphQLNamedType::InputObject(input_object_type) => {
                for field in input_object_type.get_fields().values() {
                    collect_referenced_types(field.r#type.get_named_type(), type_set, arena);
                }
            }
            GraphQLNamedType::Scalar(_) | GraphQLNamedType::Enum(_) => {}
        }
    }
}

/// PORT: graphql-js handles object and interface types in one branch.
fn collect_object_or_interface_types(
    interfaces: &[TypeId],
    fields: &IndexMap<&str, GraphQLField>,
    type_set: &mut TypeSet,
    arena: &TypeArena,
) {
    for &interface_type in interfaces {
        collect_referenced_types(interface_type, type_set, arena);
    }

    for field in fields.values() {
        collect_referenced_types(field.r#type.get_named_type(), type_set, arena);

        for arg in &field.args {
            collect_referenced_types(arg.r#type.get_named_type(), type_set, arena);
        }
    }
}
