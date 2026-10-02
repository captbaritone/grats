//! Port of graphql-js `utilities/extendSchema.ts`.
//!
//! PORT: Only `extendSchemaImpl` is ported, and only for extending an empty
//! schema, which is how `buildASTSchema` uses it. Extending existing types
//! (`extendNamedType` and friends) is not ported.
//!
//! graphql-js builds fields, interfaces and union members in thunks, which the
//! `GraphQLSchema` constructor forces, and builds default values while doing
//! so. Here they are built before returning the config, in this order:
//!
//! 1. Each type definition, with the parts graphql-js builds immediately.
//! 2. The thunked parts of every type in the type map, without default values.
//! 3. The default values of input fields. Coercing a default value reads the
//!    default values of the input object types it contains, so each input
//!    object type's dependencies are resolved first.
//! 4. The default values of field arguments.
//! 5. Root operation types and directives.
//!
//! The results are the same. Only which error is reported first can differ, for
//! documents that `assumeValidSDL` assumes are valid.

use indexmap::IndexMap;
use rustc_hash::FxHashMap;

use crate::execution::values::get_directive_values;
use crate::js_value::Value;
use crate::language::ast::{
    ConstDirectiveNode, ConstValueNode, DefinitionNode, DirectiveDefinitionNode, DocumentNode,
    EnumValueDefinitionNode, FieldDefinitionNode, InputValueDefinitionNode, NamedTypeNode,
    NullableTypeNode, OperationTypeDefinitionNode, OperationTypeNode, SchemaDefinitionNode,
    SchemaExtensionNode, TypeNode,
};
use crate::r#type::definition::{
    GraphQLArgument, GraphQLEnumType, GraphQLEnumValue, GraphQLField, GraphQLInputField,
    GraphQLInputObjectType, GraphQLInterfaceType, GraphQLNamedType, GraphQLObjectType,
    GraphQLScalarType, GraphQLType, GraphQLUnionType, TypeArena, TypeId, define_enum_values,
};
use crate::r#type::directives::{
    GRAPHQL_DEPRECATED_DIRECTIVE, GRAPHQL_ONE_OF_DIRECTIVE, GRAPHQL_SPECIFIED_BY_DIRECTIVE,
    GraphQLDirective,
};
use crate::r#type::introspection::{INTROSPECTION_TYPES, is_introspection_type};
use crate::r#type::scalars::{SPECIFIED_SCALAR_TYPES, is_specified_scalar_type};
use crate::r#type::schema::GraphQLSchemaConfig;
use crate::utilities::value_from_ast::value_from_ast;
use crate::utilities::value_from_ast_untyped::value_from_ast_untyped;

pub fn extend_schema_impl<'a>(
    schema_config: GraphQLSchemaConfig<'a>,
    document_ast: &'a DocumentNode,
) -> GraphQLSchemaConfig<'a> {
    assert!(
        schema_config.types.is_empty()
            && schema_config.directives.as_ref().is_none_or(Vec::is_empty),
        "Only extending an empty schema is supported"
    );

    // Collect the type definitions and extensions found in the document.
    let mut type_defs: Vec<&'a DefinitionNode> = Vec::new();
    let mut type_extensions_map: FxHashMap<&'a str, Vec<&'a DefinitionNode>> = FxHashMap::default();

    // New directives and types are separate because a directives and types can
    // have the same name. For example, a type named "skip".
    let mut directive_defs: Vec<&'a DirectiveDefinitionNode> = Vec::new();

    let mut schema_def: Option<&'a SchemaDefinitionNode> = None;
    // Schema extensions are collected which may add additional operation types.
    let mut schema_extensions: Vec<&'a SchemaExtensionNode> = Vec::new();

    for def in &document_ast.definitions {
        match def {
            DefinitionNode::SchemaDefinition(def) => schema_def = Some(def),
            DefinitionNode::SchemaExtension(def) => schema_extensions.push(def),
            DefinitionNode::DirectiveDefinition(def) => directive_defs.push(def),
            DefinitionNode::ScalarTypeDefinition(_)
            | DefinitionNode::ObjectTypeDefinition(_)
            | DefinitionNode::InterfaceTypeDefinition(_)
            | DefinitionNode::UnionTypeDefinition(_)
            | DefinitionNode::EnumTypeDefinition(_)
            | DefinitionNode::InputObjectTypeDefinition(_) => type_defs.push(def),
            DefinitionNode::ScalarTypeExtension(_)
            | DefinitionNode::ObjectTypeExtension(_)
            | DefinitionNode::InterfaceTypeExtension(_)
            | DefinitionNode::UnionTypeExtension(_)
            | DefinitionNode::EnumTypeExtension(_)
            | DefinitionNode::InputObjectTypeExtension(_) => {
                let extended_type_name = type_system_definition_name(def);
                type_extensions_map
                    .entry(extended_type_name)
                    .or_default()
                    .push(def);
            }
        }
    }

    // If this document contains no new types, extensions, or directives then
    // return the same unmodified GraphQLSchema instance.
    if type_extensions_map.is_empty()
        && type_defs.is_empty()
        && directive_defs.is_empty()
        && schema_extensions.is_empty()
        && schema_def.is_none()
    {
        return schema_config;
    }

    let mut builder = Builder::new(schema_config.arena, type_extensions_map);

    for type_node in type_defs {
        let name = type_system_definition_name(type_node);
        let r#type = match builder.std_type_map.get(name) {
            Some(&std_type) => std_type,
            None => builder.build_type(type_node),
        };
        builder.type_map.insert(name, r#type);
    }

    builder.build_thunks();
    builder.build_default_values();

    // Get the extended root operation types.
    let mut query = schema_config.query;
    let mut mutation = schema_config.mutation;
    let mut subscription = schema_config.subscription;
    // Then, incorporate schema definition and all schema extensions.
    let operation_types_nodes = schema_def
        .map(|schema_def| schema_def.operation_types.as_slice())
        .into_iter()
        .chain(
            schema_extensions
                .iter()
                .map(|node| node.operation_types.as_deref().unwrap_or_default()),
        );
    for operation_types in operation_types_nodes {
        for (operation, r#type) in builder.get_operation_types(operation_types) {
            match operation {
                OperationTypeNode::Query => query = Some(r#type),
                OperationTypeNode::Mutation => mutation = Some(r#type),
                OperationTypeNode::Subscription => subscription = Some(r#type),
            }
        }
    }

    let mut directives = schema_config.directives.unwrap_or_default();
    directives.extend(
        directive_defs
            .into_iter()
            .map(|node| builder.build_directive(node)),
    );

    let mut extension_ast_nodes = schema_config.extension_ast_nodes;
    extension_ast_nodes.extend(schema_extensions);

    // Then produce and return a Schema config with these types.
    GraphQLSchemaConfig {
        description: schema_def
            .and_then(|schema_def| schema_def.description.as_ref())
            .map(|description| description.value.as_str())
            .or(schema_config.description),
        query,
        mutation,
        subscription,
        types: builder.type_map.values().copied().collect(),
        directives: Some(directives),
        ast_node: schema_def.or(schema_config.ast_node),
        extension_ast_nodes,
        arena: builder.arena,
    }
}

/// PORT: graphql-js reads `def.name.value`, which every type definition and
/// type extension node has.
fn type_system_definition_name(def: &DefinitionNode) -> &str {
    match def {
        DefinitionNode::ScalarTypeDefinition(def) => &def.name.value,
        DefinitionNode::ObjectTypeDefinition(def) => &def.name.value,
        DefinitionNode::InterfaceTypeDefinition(def) => &def.name.value,
        DefinitionNode::UnionTypeDefinition(def) => &def.name.value,
        DefinitionNode::EnumTypeDefinition(def) => &def.name.value,
        DefinitionNode::InputObjectTypeDefinition(def) => &def.name.value,
        DefinitionNode::ScalarTypeExtension(def) => &def.name.value,
        DefinitionNode::ObjectTypeExtension(def) => &def.name.value,
        DefinitionNode::InterfaceTypeExtension(def) => &def.name.value,
        DefinitionNode::UnionTypeExtension(def) => &def.name.value,
        DefinitionNode::EnumTypeExtension(def) => &def.name.value,
        DefinitionNode::InputObjectTypeExtension(def) => &def.name.value,
        DefinitionNode::SchemaDefinition(_)
        | DefinitionNode::SchemaExtension(_)
        | DefinitionNode::DirectiveDefinition(_) => unreachable!("Not a type definition"),
    }
}

/// PORT: graphql-js keeps this state in variables that the functions nested in
/// `extendSchemaImpl` close over.
struct Builder<'a> {
    arena: TypeArena<'a>,
    type_map: IndexMap<&'a str, TypeId>,
    type_extensions_map: FxHashMap<&'a str, Vec<&'a DefinitionNode>>,
    /// PORT: graphql-js defines this at module level, from the global specified
    /// scalar and introspection type objects.
    std_type_map: FxHashMap<&'a str, TypeId>,
}

/// The progress of building an input object type's default values.
enum DefaultValuesState {
    InProgress,
    Done,
}

impl<'a> Builder<'a> {
    fn new(
        arena: TypeArena<'a>,
        type_extensions_map: FxHashMap<&'a str, Vec<&'a DefinitionNode>>,
    ) -> Self {
        let std_type_map = SPECIFIED_SCALAR_TYPES
            .into_iter()
            .chain(INTROSPECTION_TYPES)
            .map(|r#type| (arena[r#type].name(), r#type))
            .collect();
        Builder {
            arena,
            type_map: IndexMap::new(),
            type_extensions_map,
            std_type_map,
        }
    }

    fn get_operation_types(
        &self,
        operation_types_nodes: &'a [OperationTypeDefinitionNode],
    ) -> Vec<(OperationTypeNode, TypeId)> {
        // Note: While this could make early assertions to get the correctly
        // typed values below, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.
        operation_types_nodes
            .iter()
            .map(|operation_type| {
                (
                    operation_type.operation,
                    self.get_named_type(&operation_type.r#type),
                )
            })
            .collect()
    }

    fn get_named_type(&self, node: &NamedTypeNode) -> TypeId {
        let name = node.name.value.as_str();
        let r#type = self
            .std_type_map
            .get(name)
            .or_else(|| self.type_map.get(name));
        match r#type {
            Some(&r#type) => r#type,
            None => panic!("Unknown type: \"{name}\"."),
        }
    }

    fn get_wrapped_type(&self, node: &TypeNode) -> GraphQLType {
        match node {
            TypeNode::ListType(node) => {
                GraphQLType::List(Box::new(self.get_wrapped_type(&node.r#type)))
            }
            TypeNode::NonNullType(node) => GraphQLType::NonNull(Box::new(match &*node.r#type {
                NullableTypeNode::ListType(node) => {
                    GraphQLType::List(Box::new(self.get_wrapped_type(&node.r#type)))
                }
                NullableTypeNode::NamedType(node) => GraphQLType::Named(self.get_named_type(node)),
            })),
            TypeNode::NamedType(node) => GraphQLType::Named(self.get_named_type(node)),
        }
    }

    fn build_directive(&self, node: &'a DirectiveDefinitionNode) -> GraphQLDirective<'a> {
        let mut args = self.build_argument_map(&node.arguments);
        for arg in &mut args {
            arg.default_value = self.build_default_value(arg.ast_node, &arg.r#type);
        }
        GraphQLDirective {
            name: &node.name.value,
            description: node.description.as_ref().map(|d| d.value.as_str()),
            locations: node
                .locations
                .iter()
                .map(|name| name.value.as_str())
                .collect(),
            is_repeatable: node.repeatable,
            args,
            ast_node: Some(node),
        }
    }

    /// PORT: graphql-js passes the nodes and reads each one's `fields`.
    fn build_field_map(
        &self,
        nodes_fields: impl Iterator<Item = &'a Option<Vec<FieldDefinitionNode>>>,
    ) -> IndexMap<&'a str, GraphQLField<'a>> {
        let mut field_config_map = IndexMap::new();
        for node_fields in nodes_fields {
            for field in node_fields.iter().flatten() {
                field_config_map.insert(
                    field.name.value.as_str(),
                    GraphQLField {
                        name: &field.name.value,
                        // Note: While this could make assertions to get the correctly typed
                        // value, that would throw immediately while type system validation
                        // with validateSchema() will produce more actionable results.
                        r#type: self.get_wrapped_type(&field.r#type),
                        description: field.description.as_ref().map(|d| d.value.as_str()),
                        args: self.build_argument_map(&field.arguments),
                        deprecation_reason: self.get_deprecation_reason(&field.directives),
                        ast_node: Some(field),
                    },
                );
            }
        }
        field_config_map
    }

    /// PORT: Default values are built by `build_argument_default_values`.
    fn build_argument_map(
        &self,
        args: &'a Option<Vec<InputValueDefinitionNode>>,
    ) -> Vec<GraphQLArgument<'a>> {
        let mut arg_config_map = IndexMap::new();
        for arg in args.iter().flatten() {
            // Note: While this could make assertions to get the correctly typed
            // value, that would throw immediately while type system validation
            // with validateSchema() will produce more actionable results.
            let r#type = self.get_wrapped_type(&arg.r#type);
            arg_config_map.insert(
                arg.name.value.as_str(),
                GraphQLArgument {
                    name: &arg.name.value,
                    r#type,
                    description: arg.description.as_ref().map(|d| d.value.as_str()),
                    default_value: None,
                    deprecation_reason: self.get_deprecation_reason(&arg.directives),
                    ast_node: Some(arg),
                },
            );
        }
        // defineArguments
        arg_config_map.into_values().collect()
    }

    /// PORT: graphql-js calls `valueFromAST` in `buildArgumentMap` and
    /// `buildInputFieldMap`.
    fn build_default_value(
        &self,
        ast_node: Option<&'a InputValueDefinitionNode>,
        r#type: &GraphQLType,
    ) -> Option<Value> {
        let default_value = ast_node.and_then(|node| node.default_value.as_ref());
        value_from_ast(default_value, r#type, &self.arena)
    }

    /// PORT: graphql-js passes the nodes and reads each one's `fields`. Default
    /// values are built by `build_input_field_default_values`.
    fn build_input_field_map(
        &self,
        nodes_fields: impl Iterator<Item = &'a Option<Vec<InputValueDefinitionNode>>>,
    ) -> IndexMap<&'a str, GraphQLInputField<'a>> {
        let mut input_field_map = IndexMap::new();
        for node_fields in nodes_fields {
            for field in node_fields.iter().flatten() {
                // Note: While this could make assertions to get the correctly typed
                // value, that would throw immediately while type system validation
                // with validateSchema() will produce more actionable results.
                let r#type = self.get_wrapped_type(&field.r#type);
                input_field_map.insert(
                    field.name.value.as_str(),
                    GraphQLInputField {
                        name: &field.name.value,
                        r#type,
                        description: field.description.as_ref().map(|d| d.value.as_str()),
                        default_value: None,
                        deprecation_reason: self.get_deprecation_reason(&field.directives),
                        ast_node: Some(field),
                    },
                );
            }
        }
        input_field_map
    }

    /// PORT: graphql-js passes the nodes and reads each one's `values`.
    fn build_enum_value_map(
        &self,
        nodes_values: impl Iterator<Item = &'a Option<Vec<EnumValueDefinitionNode>>>,
    ) -> Vec<GraphQLEnumValue<'a>> {
        let mut enum_value_map = Vec::new();
        for node_values in nodes_values {
            for value in node_values.iter().flatten() {
                enum_value_map.push(GraphQLEnumValue {
                    name: &value.name.value,
                    description: value.description.as_ref().map(|d| d.value.as_str()),
                    deprecation_reason: self.get_deprecation_reason(&value.directives),
                    ast_node: Some(value),
                });
            }
        }
        enum_value_map
    }

    /// PORT: graphql-js passes the nodes and reads each one's `interfaces`.
    fn build_interfaces(
        &self,
        nodes_interfaces: impl Iterator<Item = &'a Option<Vec<NamedTypeNode>>>,
    ) -> Vec<TypeId> {
        // Note: While this could make assertions to get the correctly typed
        // values below, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.
        nodes_interfaces
            .flat_map(|interfaces| interfaces.iter().flatten())
            .map(|node| self.get_named_type(node))
            .collect()
    }

    /// PORT: graphql-js passes the nodes and reads each one's `types`.
    fn build_union_types(
        &self,
        nodes_types: impl Iterator<Item = &'a Option<Vec<NamedTypeNode>>>,
    ) -> Vec<TypeId> {
        // Note: While this could make assertions to get the correctly typed
        // values below, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.
        nodes_types
            .flat_map(|types| types.iter().flatten())
            .map(|node| self.get_named_type(node))
            .collect()
    }

    /// Builds the parts of a type that graphql-js doesn't build in thunks.
    /// `build_thunks` builds the rest.
    ///
    /// PORT: graphql-js concatenates extension nodes of any kind, relying on
    /// validation to reject extensions of the wrong kind. Here extension nodes
    /// of the wrong kind are ignored.
    fn build_type(&mut self, ast_node: &'a DefinitionNode) -> TypeId {
        let name = type_system_definition_name(ast_node);
        let extension_ast_nodes: &[&'a DefinitionNode] = self
            .type_extensions_map
            .get(name)
            .map(Vec::as_slice)
            .unwrap_or_default();

        macro_rules! extensions_of_kind {
            ($kind:ident) => {
                extension_ast_nodes
                    .iter()
                    .filter_map(|node| match node {
                        DefinitionNode::$kind(node) => Some(node),
                        _ => None,
                    })
                    .collect::<Vec<_>>()
            };
        }

        let r#type = match ast_node {
            DefinitionNode::ObjectTypeDefinition(ast_node) => {
                GraphQLNamedType::Object(GraphQLObjectType {
                    name,
                    description: ast_node.description.as_ref().map(|d| d.value.as_str()),
                    interfaces: Vec::new(),
                    fields: IndexMap::new(),
                    ast_node: Some(ast_node),
                    extension_ast_nodes: extensions_of_kind!(ObjectTypeExtension),
                })
            }
            DefinitionNode::InterfaceTypeDefinition(ast_node) => {
                GraphQLNamedType::Interface(GraphQLInterfaceType {
                    name,
                    description: ast_node.description.as_ref().map(|d| d.value.as_str()),
                    interfaces: Vec::new(),
                    fields: IndexMap::new(),
                    ast_node: Some(ast_node),
                    extension_ast_nodes: extensions_of_kind!(InterfaceTypeExtension),
                })
            }
            DefinitionNode::EnumTypeDefinition(ast_node) => {
                let extension_ast_nodes = extensions_of_kind!(EnumTypeExtension);
                let all_nodes_values = std::iter::once(&ast_node.values)
                    .chain(extension_ast_nodes.iter().map(|node| &node.values));
                GraphQLNamedType::Enum(GraphQLEnumType {
                    name,
                    description: ast_node.description.as_ref().map(|d| d.value.as_str()),
                    values: define_enum_values(self.build_enum_value_map(all_nodes_values)),
                    ast_node: Some(ast_node),
                    extension_ast_nodes,
                })
            }
            DefinitionNode::UnionTypeDefinition(ast_node) => {
                GraphQLNamedType::Union(GraphQLUnionType {
                    name,
                    description: ast_node.description.as_ref().map(|d| d.value.as_str()),
                    types: Vec::new(),
                    ast_node: Some(ast_node),
                    extension_ast_nodes: extensions_of_kind!(UnionTypeExtension),
                })
            }
            DefinitionNode::ScalarTypeDefinition(ast_node) => {
                GraphQLNamedType::Scalar(GraphQLScalarType {
                    name,
                    description: ast_node.description.as_ref().map(|d| d.value.as_str()),
                    specified_by_url: self.get_specified_by_url(&ast_node.directives),
                    // graphql-js's default `parseLiteral` for custom scalars.
                    parse_literal: |value_node| Ok(value_from_ast_untyped(value_node)),
                    ast_node: Some(ast_node),
                    extension_ast_nodes: extensions_of_kind!(ScalarTypeExtension),
                })
            }
            DefinitionNode::InputObjectTypeDefinition(ast_node) => {
                GraphQLNamedType::InputObject(GraphQLInputObjectType {
                    name,
                    description: ast_node.description.as_ref().map(|d| d.value.as_str()),
                    fields: IndexMap::new(),
                    ast_node: Some(ast_node),
                    extension_ast_nodes: extensions_of_kind!(InputObjectTypeExtension),
                    is_one_of: self.is_one_of(&ast_node.directives),
                })
            }
            _ => unreachable!("Not a type definition"),
        };
        self.arena.push(r#type)
    }

    /// Builds the parts of each type in the type map that graphql-js builds in
    /// thunks, except for default values.
    fn build_thunks(&mut self) {
        for &id in self.type_map.values() {
            // Builtin types are not extended.
            if is_introspection_type(id) || is_specified_scalar_type(id) {
                continue;
            }
            match &self.arena[id] {
                GraphQLNamedType::Object(t) => {
                    let ast_node = t.ast_node.expect("Built from a definition");
                    let interfaces = self.build_interfaces(
                        std::iter::once(&ast_node.interfaces)
                            .chain(t.extension_ast_nodes.iter().map(|&node| &node.interfaces)),
                    );
                    let fields = self.build_field_map(
                        std::iter::once(&ast_node.fields)
                            .chain(t.extension_ast_nodes.iter().map(|&node| &node.fields)),
                    );
                    let GraphQLNamedType::Object(t) = &mut self.arena[id] else {
                        unreachable!()
                    };
                    t.interfaces = interfaces;
                    t.fields = fields;
                }
                GraphQLNamedType::Interface(t) => {
                    let ast_node = t.ast_node.expect("Built from a definition");
                    let interfaces = self.build_interfaces(
                        std::iter::once(&ast_node.interfaces)
                            .chain(t.extension_ast_nodes.iter().map(|&node| &node.interfaces)),
                    );
                    let fields = self.build_field_map(
                        std::iter::once(&ast_node.fields)
                            .chain(t.extension_ast_nodes.iter().map(|&node| &node.fields)),
                    );
                    let GraphQLNamedType::Interface(t) = &mut self.arena[id] else {
                        unreachable!()
                    };
                    t.interfaces = interfaces;
                    t.fields = fields;
                }
                GraphQLNamedType::Union(t) => {
                    let ast_node = t.ast_node.expect("Built from a definition");
                    let types = self.build_union_types(
                        std::iter::once(&ast_node.types)
                            .chain(t.extension_ast_nodes.iter().map(|&node| &node.types)),
                    );
                    let GraphQLNamedType::Union(t) = &mut self.arena[id] else {
                        unreachable!()
                    };
                    t.types = types;
                }
                GraphQLNamedType::InputObject(t) => {
                    let ast_node = t.ast_node.expect("Built from a definition");
                    let fields = self.build_input_field_map(
                        std::iter::once(&ast_node.fields)
                            .chain(t.extension_ast_nodes.iter().map(|&node| &node.fields)),
                    );
                    let GraphQLNamedType::InputObject(t) = &mut self.arena[id] else {
                        unreachable!()
                    };
                    t.fields = fields;
                }
                GraphQLNamedType::Scalar(_) | GraphQLNamedType::Enum(_) => {}
            }
        }
    }

    /// Builds the default values of input fields, then of field arguments.
    fn build_default_values(&mut self) {
        let ids: Vec<TypeId> = self.type_map.values().copied().collect();
        let mut states = FxHashMap::default();
        for &id in &ids {
            if let GraphQLNamedType::InputObject(_) = &self.arena[id] {
                self.build_input_field_default_values(id, &mut states);
            }
        }
        for &id in &ids {
            let fields = match &self.arena[id] {
                GraphQLNamedType::Object(t) if !is_introspection_type(id) => &t.fields,
                GraphQLNamedType::Interface(t) => &t.fields,
                _ => continue,
            };
            let default_values: Vec<Vec<Option<Value>>> = fields
                .values()
                .map(|field| {
                    field
                        .args
                        .iter()
                        .map(|arg| self.build_default_value(arg.ast_node, &arg.r#type))
                        .collect()
                })
                .collect();
            let fields = match &mut self.arena[id] {
                GraphQLNamedType::Object(t) => &mut t.fields,
                GraphQLNamedType::Interface(t) => &mut t.fields,
                _ => unreachable!(),
            };
            for (field, default_values) in fields.values_mut().zip(default_values) {
                for (arg, default_value) in field.args.iter_mut().zip(default_values) {
                    arg.default_value = default_value;
                }
            }
        }
    }

    /// PORT: In graphql-js, coercing a default value that contains an object
    /// calls the input object type's `getFields()`, which builds its fields,
    /// including their default values, the first time it is called. If that
    /// happens while building the same type's fields, graphql-js recurses until
    /// the stack overflows. Here that panics instead.
    fn build_input_field_default_values(
        &mut self,
        id: TypeId,
        states: &mut FxHashMap<TypeId, DefaultValuesState>,
    ) {
        match states.get(&id) {
            Some(DefaultValuesState::Done) => return,
            Some(DefaultValuesState::InProgress) => panic!(
                "The default values of input object type \"{}\" depend on themselves.",
                self.arena[id].name()
            ),
            None => {}
        }
        states.insert(id, DefaultValuesState::InProgress);

        let GraphQLNamedType::InputObject(t) = &self.arena[id] else {
            unreachable!("Only input object types have input fields")
        };
        let mut dependencies = Vec::new();
        for field in t.fields.values() {
            if let Some(default_value) = field.ast_node.and_then(|node| node.default_value.as_ref())
            {
                collect_input_object_dependencies(
                    default_value,
                    &field.r#type,
                    &self.arena,
                    &mut dependencies,
                );
            }
        }
        for dependency in dependencies {
            self.build_input_field_default_values(dependency, states);
        }

        let GraphQLNamedType::InputObject(t) = &self.arena[id] else {
            unreachable!()
        };
        let default_values: Vec<Option<Value>> = t
            .fields
            .values()
            .map(|field| self.build_default_value(field.ast_node, &field.r#type))
            .collect();
        let GraphQLNamedType::InputObject(t) = &mut self.arena[id] else {
            unreachable!()
        };
        for (field, default_value) in t.fields.values_mut().zip(default_values) {
            field.default_value = default_value;
        }

        states.insert(id, DefaultValuesState::Done);
    }

    /// Given a field or enum value node, returns the string value for the
    /// deprecation reason.
    ///
    /// PORT: graphql-js passes the node and reads its `directives`. An explicit
    /// `null` reason is `None`: graphql-js checks `deprecationReason != null`.
    fn get_deprecation_reason(
        &self,
        directives: &Option<Vec<ConstDirectiveNode>>,
    ) -> Option<String> {
        let mut deprecated = get_directive_values(
            &GRAPHQL_DEPRECATED_DIRECTIVE,
            directives.as_deref(),
            &self.arena,
        )?;
        match deprecated.swap_remove("reason") {
            Some(Value::String(reason)) => Some(reason),
            _ => None,
        }
    }

    /// Given a scalar node, returns the string value for the specifiedByURL.
    ///
    /// PORT: graphql-js passes the node and reads its `directives`.
    fn get_specified_by_url(&self, directives: &Option<Vec<ConstDirectiveNode>>) -> Option<String> {
        let mut specified_by = get_directive_values(
            &GRAPHQL_SPECIFIED_BY_DIRECTIVE,
            directives.as_deref(),
            &self.arena,
        )?;
        match specified_by.swap_remove("url") {
            Some(Value::String(url)) => Some(url),
            _ => None,
        }
    }

    /// Given an input object node, returns if the node should be OneOf.
    ///
    /// PORT: graphql-js passes the node and reads its `directives`.
    fn is_one_of(&self, directives: &Option<Vec<ConstDirectiveNode>>) -> bool {
        get_directive_values(
            &GRAPHQL_ONE_OF_DIRECTIVE,
            directives.as_deref(),
            &self.arena,
        )
        .is_some()
    }
}

/// PORT: Not in graphql-js. Collects the input object types whose fields
/// `valueFromAST` reads while coercing `value_node` to `type`, following the
/// same path through the value. It doesn't stop where `valueFromAST` finds an
/// invalid value, so it may collect more types than `valueFromAST` reads.
fn collect_input_object_dependencies(
    value_node: &ConstValueNode,
    r#type: &GraphQLType,
    arena: &TypeArena,
    dependencies: &mut Vec<TypeId>,
) {
    if let ConstValueNode::NullValue(_) = value_node {
        return;
    }
    match r#type {
        GraphQLType::NonNull(of_type) => {
            collect_input_object_dependencies(value_node, of_type, arena, dependencies)
        }
        GraphQLType::List(item_type) => match value_node {
            ConstValueNode::ListValue(value_node) => {
                for item_node in &value_node.values {
                    collect_input_object_dependencies(item_node, item_type, arena, dependencies);
                }
            }
            _ => collect_input_object_dependencies(value_node, item_type, arena, dependencies),
        },
        GraphQLType::Named(id) => {
            if let (GraphQLNamedType::InputObject(t), ConstValueNode::ObjectValue(value_node)) =
                (&arena[*id], value_node)
            {
                dependencies.push(*id);
                for field in t.get_fields().values() {
                    // The last field node with the name wins, as in `keyMap`.
                    let field_node = value_node
                        .fields
                        .iter()
                        .rev()
                        .find(|field_node| field_node.name.value == field.name);
                    if let Some(field_node) = field_node {
                        collect_input_object_dependencies(
                            &field_node.value,
                            &field.r#type,
                            arena,
                            dependencies,
                        );
                    }
                }
            }
        }
    }
}
