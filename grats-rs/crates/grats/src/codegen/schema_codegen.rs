//! Port of `src/codegen/schemaCodegen.ts`.

use std::collections::HashSet;

use graphql_js::js_value::Value;
use graphql_js::language::ast::{ConstDirectiveNode, ExportDefinition};
use graphql_js::r#type::definition::{
    GraphQLArgument, GraphQLEnumType, GraphQLEnumValue, GraphQLField, GraphQLInputField,
    GraphQLInputObjectType, GraphQLNamedType, GraphQLObjectType, GraphQLScalarType, GraphQLType,
    TypeId,
};
use graphql_js::r#type::directives::GraphQLDirective;
use graphql_js::r#type::schema::GraphQLSchema;
use graphql_js::utilities::value_from_ast_untyped::value_from_ast_untyped;
use indexmap::IndexMap;
use oxc_allocator::{Allocator, ArenaBox, ArenaVec};
use oxc_ast::ast::*;
use oxc_span::SPAN;

use crate::codegen::resolver_codegen::ResolverCodegen;
use crate::codegen::ts_ast_builder::{ImportSpecifier, TsAstBuilder};
use crate::grats_config::GratsConfig;
use crate::metadata::Metadata;
use crate::utils::helpers::null_throws;
use graphql_js::jsutils::natural_compare::natural_compare;

// These directives will be added to the schema by default, so we don't need to
// include them in the generated schema.
const BUILT_IN_DIRECTIVES: [&str; 5] = ["skip", "include", "deprecated", "specifiedBy", "oneOf"];

pub(crate) const BUILT_IN_SCALARS: [&str; 5] = ["String", "Int", "Float", "Boolean", "ID"];
const GQL_SCALAR_TYPE_NAME: &str = "GqlScalar";

// Given a GraphQL SDL, returns the a string of TypeScript code that generates a
// GraphQLSchema implementing that schema.
//
// PORT: Also takes the root that module paths are relative to. See
// `src/grats_root.rs`.
pub fn codegen(
    schema: &GraphQLSchema,
    resolvers: &Metadata,
    config: &GratsConfig,
    destination: &str,
    grats_root: &str,
) -> String {
    let allocator = Allocator::default();
    let mut codegen = Codegen::new(
        schema,
        resolvers,
        config,
        destination,
        grats_root,
        &allocator,
    );

    codegen.schema_declaration_export();

    codegen.print()
}

struct Codegen<'s, 'd, 'a> {
    ts: TsAstBuilder<'a>,
    resolvers: ResolverCodegen<'s>,
    type_name_mappings: IndexMap<&'d str, String>,
    type_definitions: HashSet<String>,
    schema: &'s GraphQLSchema<'d>,
}

impl<'a> AsMut<TsAstBuilder<'a>> for Codegen<'_, '_, 'a> {
    fn as_mut(&mut self) -> &mut TsAstBuilder<'a> {
        &mut self.ts
    }
}

impl<'s, 'd, 'a> Codegen<'s, 'd, 'a> {
    fn new(
        schema: &'s GraphQLSchema<'d>,
        resolvers: &'s Metadata,
        config: &GratsConfig,
        destination: &str,
        grats_root: &str,
        allocator: &'a Allocator,
    ) -> Self {
        Codegen {
            ts: TsAstBuilder::new(
                allocator,
                destination,
                &config.import_module_specifier_ending,
                grats_root,
            ),
            resolvers: ResolverCodegen::new(resolvers),
            type_name_mappings: IndexMap::new(),
            type_definitions: HashSet::new(),
            schema,
        }
    }

    fn graphql_import(&mut self, name: &str) -> Expression<'a> {
        self.ts.import(
            "graphql",
            vec![ImportSpecifier {
                name: name.to_string(),
                r#as: None,
                is_type_only: false,
            }],
        );
        self.ts.identifier(name)
    }

    fn graphql_type_import(&mut self, name: &str) -> TSType<'a> {
        self.ts.import(
            "graphql",
            vec![ImportSpecifier {
                name: name.to_string(),
                r#as: None,
                is_type_only: true,
            }],
        );
        self.ts.type_reference(name, vec![])
    }

    fn schema_declaration_export(&mut self) {
        let schema = self.schema;
        let mut scalars = Vec::new();
        for r#type in schema
            .get_type_map()
            .values()
            .filter_map(|&r#type| match &schema[r#type] {
                GraphQLNamedType::Scalar(r#type) if !BUILT_IN_SCALARS.contains(&r#type.name) => {
                    Some(r#type)
                }
                _ => None,
            })
        {
            self.ts.import(
                "grats",
                vec![ImportSpecifier {
                    name: GQL_SCALAR_TYPE_NAME.to_string(),
                    r#as: None,
                    is_type_only: true,
                }],
            );
            let exported = null_throws(r#type.ast_node.and_then(|ast| ast.exported.as_ref()));

            let local_name = format!("{}Internal", r#type.name);

            self.ts.import_user_construct(
                &exported.ts_module_path,
                exported.export_name.as_deref(),
                &local_name,
                true,
            );

            let ts = &self.ts;
            scalars.push(TSSignature::new_ts_property_signature(
                SPAN,
                false,
                false,
                false,
                ts.property_name(r#type.name),
                Some(ts.type_annotation(ts.type_reference(
                    GQL_SCALAR_TYPE_NAME,
                    vec![ts.type_reference(&local_name, vec![])],
                ))),
                ts,
            ));
        }

        let mut params = Vec::new();

        if !scalars.is_empty() {
            let ts = &self.ts;
            let scalar_config = TSSignature::new_ts_property_signature(
                SPAN,
                false,
                false,
                false,
                ts.property_name("scalars"),
                Some(ts.type_annotation(TSType::new_ts_type_literal(
                    SPAN,
                    ArenaVec::from_iter_in(scalars, ts),
                    ts,
                ))),
                ts,
            );
            let statement = Statement::new_export_declaration(
                SPAN,
                Declaration::new_ts_type_alias_declaration(
                    SPAN,
                    BindingIdentifier::new(SPAN, "SchemaConfig", ts),
                    None::<ArenaBox<TSTypeParameterDeclaration>>,
                    TSType::new_ts_type_literal(
                        SPAN,
                        ArenaVec::from_array_in([scalar_config], ts),
                        ts,
                    ),
                    false,
                    ts,
                ),
                ts,
            );
            self.ts.add_statement(statement);
            params.push(self.ts.param(
                "config",
                Some(self.ts.type_reference("SchemaConfig", vec![])),
            ));
        }
        let return_type = self.graphql_type_import("GraphQLSchema");
        let body = TsAstBuilder::create_block_with_scope(self, |this| {
            let callee = this.graphql_import("GraphQLSchema");
            let schema_config = this.schema_config();
            let statement = this
                .ts
                .return_statement(this.ts.new_expression(callee, vec![schema_config]));
            this.ts.add_statement(statement);
        });
        self.ts
            .function_declaration("getSchema", true, params, Some(return_type), body);
    }

    fn schema_config(&mut self) -> Expression<'a> {
        let properties = vec![
            self.description(self.schema.description),
            self.directives(),
            self.query(),
            self.mutation(),
            self.subscription(),
            Some(self.types()),
        ];
        self.ts.object_literal(properties)
    }

    fn directives(&mut self) -> Option<ObjectPropertyKind<'a>> {
        let schema = self.schema;
        let directives: Vec<&'s GraphQLDirective<'d>> = schema
            .get_directives()
            .iter()
            .filter(|directive| !BUILT_IN_DIRECTIVES.contains(&directive.name))
            .collect();
        if directives.is_empty() {
            return None;
        }

        let directive_objs: Vec<Expression<'a>> = directives
            .into_iter()
            .map(|directive| {
                let callee = self.graphql_import("GraphQLDirective");
                let config = self.directive_config(directive);
                self.ts.new_expression(callee, vec![config])
            })
            .collect();
        let specified_directives = self.graphql_import("specifiedDirectives");
        let ts = &self.ts;
        let elements = std::iter::once(ArrayExpressionElement::new_spread_element(
            SPAN,
            specified_directives,
            ts,
        ))
        .chain(directive_objs.into_iter().map(ArrayExpressionElement::from))
        .collect();
        Some(ts.property_assignment("directives", ts.array_literal(elements)))
    }

    fn directive_config(&mut self, directive: &'s GraphQLDirective<'d>) -> Expression<'a> {
        let name = self
            .ts
            .property_assignment("name", self.ts.string_literal(directive.name));
        let locations = directive
            .locations
            .iter()
            .map(|location| {
                let directive_location = self.graphql_import("DirectiveLocation");
                ArrayExpressionElement::from(self.ts.property_access(directive_location, location))
            })
            .collect();
        let mut props = vec![
            Some(name),
            Some(
                self.ts
                    .property_assignment("locations", self.ts.array_literal(locations)),
            ),
        ];

        if directive.description.is_some_and(|d| !d.is_empty()) {
            props.push(self.description(directive.description));
        }

        if !directive.args.is_empty() {
            let args = self.arg_map(&directive.args);
            props.push(Some(self.ts.property_assignment("args", args)));
        }

        if directive.is_repeatable {
            props.push(Some(
                self.ts
                    .property_assignment("isRepeatable", self.ts.boolean(true)),
            ));
        }

        self.ts.object_literal(props)
    }

    fn types(&mut self) -> ObjectPropertyKind<'a> {
        let schema = self.schema;
        let types = schema
            .get_type_map()
            .values()
            .filter(|&&r#type| {
                let name = schema[r#type].name();
                !(name.starts_with("__")
                    || name.starts_with("Introspection")
                    || name.starts_with("Schema")
                    || BUILT_IN_SCALARS.contains(&name))
            })
            .map(|&r#type| ArrayExpressionElement::from(self.named_type_reference(r#type)))
            .collect();
        self.ts
            .property_assignment("types", self.ts.array_literal(types))
    }

    /// PORT: Takes the deprecation reason of the field, enum value, argument
    /// or input field, since they are different Rust types.
    fn deprecated(&self, deprecation_reason: Option<&str>) -> Option<ObjectPropertyKind<'a>> {
        let deprecation_reason = deprecation_reason.filter(|reason| !reason.is_empty())?;
        Some(self.ts.property_assignment(
            "deprecationReason",
            self.ts.string_literal(deprecation_reason),
        ))
    }

    fn description(&self, description: Option<&str>) -> Option<ObjectPropertyKind<'a>> {
        let description = description.filter(|description| !description.is_empty())?;
        Some(
            self.ts
                .property_assignment("description", self.ts.string_literal(description)),
        )
    }

    fn query(&mut self) -> Option<ObjectPropertyKind<'a>> {
        let query = self.schema.get_query_type()?;
        let object_type = self.object_type(query);
        Some(self.ts.property_assignment("query", object_type))
    }

    fn mutation(&mut self) -> Option<ObjectPropertyKind<'a>> {
        let mutation = self.schema.get_mutation_type()?;
        let object_type = self.object_type(mutation);
        Some(self.ts.property_assignment("mutation", object_type))
    }

    fn subscription(&mut self) -> Option<ObjectPropertyKind<'a>> {
        let subscription = self.schema.get_subscription_type()?;
        let object_type = self.object_type(subscription);
        Some(self.ts.property_assignment("subscription", object_type))
    }

    /// PORT: Named types are referenced by `TypeId`.
    fn object_type(&mut self, obj: TypeId) -> Expression<'a> {
        let GraphQLNamedType::Object(obj) = &self.schema[obj] else {
            unreachable!("Expected an object type");
        };
        let var_name = format!("{}Type", obj.name);
        if !self.type_definitions.contains(&var_name) {
            self.type_definitions.insert(var_name.clone());

            let ast = null_throws(obj.ast_node);

            let callee = self.graphql_import("GraphQLObjectType");
            let config = self.object_type_config(obj, ast.exported.as_ref());
            let initializer = self.ts.new_expression(callee, vec![config]);
            // We need to explicitly specify the type due to circular references in
            // the definition.
            let r#type = self.ts.type_reference("GraphQLObjectType", vec![]);
            self.ts
                .const_declaration(&var_name, initializer, Some(r#type));
        }
        self.ts.identifier(&var_name)
    }

    fn object_type_config(
        &mut self,
        obj: &'s GraphQLObjectType<'d>,
        source_export: Option<&'s ExportDefinition>,
    ) -> Expression<'a> {
        let properties = vec![
            Some(
                self.ts
                    .property_assignment("name", self.ts.string_literal(obj.name)),
            ),
            self.description(obj.description),
            Some(self.fields(obj.name, obj.get_fields(), false, source_export)),
            self.interfaces(obj.get_interfaces()),
            self.extensions(obj.ast_node.and_then(|ast| ast.directives.as_deref())),
        ];
        self.ts.object_literal(properties)
    }

    /// PORT: Takes the object or interface type's name and fields, since they
    /// are different Rust types.
    fn fields(
        &mut self,
        obj_name: &'d str,
        fields: &'s IndexMap<&'d str, GraphQLField<'d>>,
        is_interface: bool,
        source_export: Option<&'s ExportDefinition>,
    ) -> ObjectPropertyKind<'a> {
        let fields = fields
            .iter()
            .map(|(name, field)| {
                let config = self.field_config(field, obj_name, is_interface, source_export);
                Some(self.ts.property_assignment(name, config))
            })
            .collect();

        let statement = self.ts.return_statement(self.ts.object_literal(fields));
        self.ts.method("fields", vec![], vec![statement], false)
    }

    /// PORT: Takes the object or interface type's interfaces, since they are
    /// different Rust types.
    fn interfaces(&mut self, interfaces: &'s [TypeId]) -> Option<ObjectPropertyKind<'a>> {
        if interfaces.is_empty() {
            return None;
        }
        let interfaces = interfaces
            .iter()
            .map(|&i| ArrayExpressionElement::from(self.interface_type(i)))
            .collect();
        let statement = self.ts.return_statement(self.ts.array_literal(interfaces));
        Some(self.ts.method("interfaces", vec![], vec![statement], false))
    }

    fn interface_type(&mut self, id: TypeId) -> Expression<'a> {
        let GraphQLNamedType::Interface(obj) = &self.schema[id] else {
            unreachable!("Expected an interface type");
        };
        let var_name = format!("{}Type", obj.name);
        if !self.type_definitions.contains(&var_name) {
            self.type_definitions.insert(var_name.clone());

            let callee = self.graphql_import("GraphQLInterfaceType");
            // TODO: Find interface export if exported.
            let config = self.interface_type_config(id, None);
            let initializer = self.ts.new_expression(callee, vec![config]);
            // We need to explicitly specify the type due to circular references in
            // the definition.
            self.graphql_import("GraphQLInterfaceType");
            let r#type = self.ts.type_reference("GraphQLInterfaceType", vec![]);
            self.ts
                .const_declaration(&var_name, initializer, Some(r#type));
        }
        self.ts.identifier(&var_name)
    }

    /// PORT: The TypeScript implementation calls `getPossibleTypes` here and
    /// discards the result.
    fn interface_type_config(
        &mut self,
        id: TypeId,
        source_export: Option<&'s ExportDefinition>,
    ) -> Expression<'a> {
        let GraphQLNamedType::Interface(obj) = &self.schema[id] else {
            unreachable!("Expected an interface type");
        };
        let properties = vec![
            self.description(obj.description),
            Some(
                self.ts
                    .property_assignment("name", self.ts.string_literal(obj.name)),
            ),
            Some(self.fields(obj.name, obj.get_fields(), true, source_export)),
            self.interfaces(obj.get_interfaces()),
            self.resolve_type(id),
            self.extensions(obj.ast_node.and_then(|ast| ast.directives.as_deref())),
        ];
        self.ts.object_literal(properties)
    }

    fn union_type(&mut self, id: TypeId) -> Expression<'a> {
        let var_name = format!("{}Type", self.schema[id].name());
        if !self.type_definitions.contains(&var_name) {
            self.type_definitions.insert(var_name.clone());
            let callee = self.graphql_import("GraphQLUnionType");
            let config = self.union_type_config(id);
            let initializer = self.ts.new_expression(callee, vec![config]);
            // We need to explicitly specify the type due to circular references in
            // the definition.
            self.graphql_import("GraphQLUnionType");
            let r#type = self.ts.type_reference("GraphQLUnionType", vec![]);
            self.ts
                .const_declaration(&var_name, initializer, Some(r#type));
        }
        self.ts.identifier(&var_name)
    }

    fn resolve_type(&mut self, obj: TypeId) -> Option<ObjectPropertyKind<'a>> {
        let schema = self.schema;
        let mut needs_resolve_type = false;
        for &t in schema.get_possible_types(obj) {
            let GraphQLNamedType::Object(t) = &schema[t] else {
                unreachable!("Expected an object type");
            };
            let ast = null_throws(t.ast_node);
            if ast.has_type_name_field {
                continue;
            }

            if let Some(exported_metadata) = &ast.exported {
                if !self.type_name_mappings.contains_key(t.name) {
                    let local_name = format!("{}Class", t.name);
                    self.ts.import_user_construct(
                        &exported_metadata.ts_module_path,
                        exported_metadata.export_name.as_deref(),
                        &local_name,
                        false,
                    );

                    self.type_name_mappings.insert(t.name, local_name);
                }
                needs_resolve_type = true;
            }
        }
        if needs_resolve_type {
            return Some(self.ts.shorthand_property_assignment("resolveType"));
        }
        // Just use the default resolveType
        None
    }

    fn union_type_config(&mut self, id: TypeId) -> Expression<'a> {
        let GraphQLNamedType::Union(obj) = &self.schema[id] else {
            unreachable!("Expected a union type");
        };
        let name = self
            .ts
            .property_assignment("name", self.ts.string_literal(obj.name));
        let description = self.description(obj.description);
        let types = obj
            .get_types()
            .iter()
            .map(|&t| ArrayExpressionElement::from(self.named_type_reference(t)))
            .collect();
        let statement = self.ts.return_statement(self.ts.array_literal(types));
        let properties = vec![
            Some(name),
            description,
            Some(self.ts.method("types", vec![], vec![statement], false)),
            self.resolve_type(id),
            self.extensions(obj.ast_node.and_then(|ast| ast.directives.as_deref())),
        ];
        self.ts.object_literal(properties)
    }

    fn custom_scalar_type(&mut self, obj: &'s GraphQLScalarType<'d>) -> Expression<'a> {
        let var_name = format!("{}Type", obj.name);
        if !self.type_definitions.contains(&var_name) {
            self.type_definitions.insert(var_name.clone());
            let callee = self.graphql_import("GraphQLScalarType");
            let config = self.custom_scalar_type_config(obj);
            let initializer = self.ts.new_expression(callee, vec![config]);
            // We need to explicitly specify the type due to circular references in
            // the definition.
            self.graphql_import("GraphQLScalarType");
            let r#type = self.ts.type_reference("GraphQLScalarType", vec![]);
            self.ts
                .const_declaration(&var_name, initializer, Some(r#type));
        }
        self.ts.identifier(&var_name)
    }

    fn custom_scalar_type_config(&mut self, obj: &'s GraphQLScalarType<'d>) -> Expression<'a> {
        let scalar_config = self
            .ts
            .property_access_chain(self.ts.identifier("config"), &["scalars", obj.name]);

        let ts = &self.ts;
        let properties = vec![
            self.description(obj.description),
            obj.specified_by_url
                .as_deref()
                .filter(|url| !url.is_empty())
                .map(|url| ts.property_assignment("specifiedByURL", ts.string_literal(url))),
            Some(ts.property_assignment("name", ts.string_literal(obj.name))),
            self.extensions(obj.ast_node.and_then(|ast| ast.directives.as_deref())),
            Some(ts.spread_assignment(scalar_config)),
        ];
        self.ts.object_literal(properties)
    }

    fn input_type(&mut self, obj: &'s GraphQLInputObjectType<'d>) -> Expression<'a> {
        let var_name = format!("{}Type", obj.name);
        if !self.type_definitions.contains(&var_name) {
            self.type_definitions.insert(var_name.clone());
            let callee = self.graphql_import("GraphQLInputObjectType");
            let config = self.input_type_config(obj);
            let initializer = self.ts.new_expression(callee, vec![config]);
            // We need to explicitly specify the type due to circular references in
            // the definition.
            self.graphql_import("GraphQLInputObjectType");
            let r#type = self.ts.type_reference("GraphQLInputObjectType", vec![]);
            self.ts
                .const_declaration(&var_name, initializer, Some(r#type));
        }
        self.ts.identifier(&var_name)
    }

    fn input_type_config(&mut self, obj: &'s GraphQLInputObjectType<'d>) -> Expression<'a> {
        let mut properties = vec![
            self.description(obj.description),
            Some(
                self.ts
                    .property_assignment("name", self.ts.string_literal(obj.name)),
            ),
            Some(self.input_fields(obj)),
            self.extensions(obj.ast_node.and_then(|ast| ast.directives.as_deref())),
        ];
        if obj.is_one_of {
            properties.push(Some(
                self.ts
                    .property_assignment("isOneOf", self.ts.boolean(true)),
            ));
        }
        self.ts.object_literal(properties)
    }

    fn input_fields(&mut self, obj: &'s GraphQLInputObjectType<'d>) -> ObjectPropertyKind<'a> {
        let fields = obj
            .get_fields()
            .iter()
            .map(|(name, field)| {
                let config = self.input_field_config(field);
                Some(self.ts.property_assignment(name, config))
            })
            .collect();

        let statement = self.ts.return_statement(self.ts.object_literal(fields));
        self.ts.method("fields", vec![], vec![statement], false)
    }

    fn input_field_config(&mut self, field: &'s GraphQLInputField<'d>) -> Expression<'a> {
        let properties = vec![
            self.description(field.description),
            self.deprecated(field.deprecation_reason.as_deref()),
            Some(
                self.ts
                    .property_assignment("name", self.ts.string_literal(field.name)),
            ),
            Some({
                let r#type = self.type_reference(&field.r#type);
                self.ts.property_assignment("type", r#type)
            }),
            self.extensions(field.ast_node.and_then(|ast| ast.directives.as_deref())),
        ];
        self.ts.object_literal(properties)
    }

    // Creates an `extensions` property containing a `grats` namespace containing
    // information about directives for a given construct. This is needed because
    // `GraphQLSchema` doesn't have a first-party way to represent directives
    // attached to schema constructs.
    fn extensions(
        &self,
        directive_nodes: Option<&[ConstDirectiveNode]>,
    ) -> Option<ObjectPropertyKind<'a>> {
        let directive_nodes = directive_nodes?;
        let directives_sans_builtin: Vec<&ConstDirectiveNode> = directive_nodes
            .iter()
            .filter(|directive| {
                // These directives have first-class ways of being represented in the
                // `GraphQLSchema` so we omit them from the extensions data.
                !BUILT_IN_DIRECTIVES.contains(&directive.name.value.as_str())
                    && directive.name.value != "semanticNonNull"
            })
            .collect();
        if directives_sans_builtin.is_empty() {
            return None;
        }

        let mut directives: Vec<Value> = Vec::new();
        for directive in directives_sans_builtin {
            let mut directive_args = IndexMap::new();
            if let Some(arguments) = &directive.arguments {
                for arg in arguments {
                    directive_args
                        .insert(arg.name.value.clone(), value_from_ast_untyped(&arg.value));
                }
            }
            directives.push(Value::Object(IndexMap::from([
                (
                    "name".to_string(),
                    Value::String(directive.name.value.clone()),
                ),
                ("args".to_string(), Value::Object(directive_args)),
            ])));
        }

        Some(self.ts.property_assignment(
            "extensions",
            self.ts.json(&Value::Object(IndexMap::from([(
                "grats".to_string(),
                Value::Object(IndexMap::from([(
                    "directives".to_string(),
                    Value::List(directives),
                )])),
            )]))),
        ))
    }

    fn field_config(
        &mut self,
        field: &'s GraphQLField<'d>,
        parent_type_name: &str,
        is_interface: bool,
        source_export: Option<&'s ExportDefinition>,
    ) -> Expression<'a> {
        let mut props = vec![
            self.description(field.description),
            self.deprecated(field.deprecation_reason.as_deref()),
            Some(
                self.ts
                    .property_assignment("name", self.ts.string_literal(field.name)),
            ),
            Some({
                let r#type = self.type_reference(&field.r#type);
                self.ts.property_assignment("type", r#type)
            }),
            if field.args.is_empty() {
                None
            } else {
                let args = self.arg_map(&field.args);
                Some(self.ts.property_assignment("args", args))
            },
            self.extensions(null_throws(field.ast_node).directives.as_deref()),
        ];

        if !is_interface {
            props.extend(self.field_methods(field, parent_type_name, source_export));
        }

        self.ts.object_literal(props)
    }

    fn field_methods(
        &mut self,
        field: &'s GraphQLField<'d>,
        parent_type_name: &str,
        source_export: Option<&'s ExportDefinition>,
    ) -> Vec<Option<ObjectPropertyKind<'a>>> {
        // Note: We assume the default name is used here. When custom operation types are supported
        // we'll need to update this.
        if parent_type_name != "Subscription" {
            let resolve = self.resolvers.resolve_method(
                &mut self.ts,
                field.name,
                "resolve",
                parent_type_name,
                source_export,
            );
            return vec![self.resolvers.maybe_apply_semantic_null_runtime_check(
                &mut self.ts,
                field,
                resolve,
                "resolve",
            )];
        }
        vec![
            // TODO: Maybe avoid adding `assertNonNull` for subscription resolvers?
            self.resolvers.resolve_method(
                &mut self.ts,
                field.name,
                "subscribe",
                parent_type_name,
                source_export,
            ),
            // Identity function (method?)
            {
                let method = self.ts.method(
                    "resolve",
                    vec![self.ts.param("payload", None)],
                    vec![self.ts.return_statement(self.ts.identifier("payload"))],
                    false,
                );
                self.resolvers.maybe_apply_semantic_null_runtime_check(
                    &mut self.ts,
                    field,
                    Some(method),
                    "resolve",
                )
            },
        ]
    }

    fn arg_map(&mut self, args: &'s [GraphQLArgument<'d>]) -> Expression<'a> {
        let properties = args
            .iter()
            .map(|arg| {
                let config = self.arg_config(arg);
                Some(self.ts.property_assignment(arg.name, config))
            })
            .collect();
        self.ts.object_literal(properties)
    }

    fn arg_config(&mut self, arg: &'s GraphQLArgument<'d>) -> Expression<'a> {
        let properties = vec![
            self.description(arg.description),
            self.deprecated(arg.deprecation_reason.as_deref()),
            Some({
                let r#type = self.type_reference(&arg.r#type);
                self.ts.property_assignment("type", r#type)
            }),
            // TODO: arg.defaultValue seems to be missing for complex objects
            arg.default_value.as_ref().map(|default_value| {
                self.ts
                    .property_assignment("defaultValue", self.default_value(default_value))
            }),
            self.extensions(arg.ast_node.and_then(|ast| ast.directives.as_deref())),
        ];
        self.ts.object_literal(properties)
    }

    fn enum_type(&mut self, obj: &'s GraphQLEnumType<'d>) -> Expression<'a> {
        let var_name = format!("{}Type", obj.name);
        if !self.type_definitions.contains(&var_name) {
            self.type_definitions.insert(var_name.clone());
            let callee = self.graphql_import("GraphQLEnumType");
            let config = self.enum_type_config(obj);
            let initializer = self.ts.new_expression(callee, vec![config]);
            // We need to explicitly specify the type due to circular references in
            // the definition.
            self.graphql_import("GraphQLEnumType");
            let r#type = self.ts.type_reference("GraphQLEnumType", vec![]);
            self.ts
                .const_declaration(&var_name, initializer, Some(r#type));
        }
        self.ts.identifier(&var_name)
    }

    fn enum_type_config(&self, obj: &'s GraphQLEnumType<'d>) -> Expression<'a> {
        let properties = vec![
            self.description(obj.description),
            Some(
                self.ts
                    .property_assignment("name", self.ts.string_literal(obj.name)),
            ),
            Some(self.enum_values(obj)),
            self.extensions(obj.ast_node.and_then(|ast| ast.directives.as_deref())),
        ];
        self.ts.object_literal(properties)
    }

    fn enum_values(&self, obj: &'s GraphQLEnumType<'d>) -> ObjectPropertyKind<'a> {
        let values = obj
            .get_values()
            .iter()
            .map(|value| {
                Some(
                    self.ts
                        .property_assignment(value.name, self.enum_value(value)),
                )
            })
            .collect();

        self.ts
            .property_assignment("values", self.ts.object_literal(values))
    }

    fn enum_value(&self, obj: &'s GraphQLEnumValue<'d>) -> Expression<'a> {
        self.ts.object_literal(vec![
            self.description(obj.description),
            self.deprecated(obj.deprecation_reason.as_deref()),
            Some(
                self.ts
                    .property_assignment("value", self.ts.string_literal(obj.name)),
            ),
            self.extensions(obj.ast_node.and_then(|ast| ast.directives.as_deref())),
        ])
    }

    fn default_value(&self, value: &Value) -> Expression<'a> {
        self.ts.json(value)
    }

    fn type_reference(&mut self, t: &'s GraphQLType) -> Expression<'a> {
        match t {
            GraphQLType::NonNull(of_type) => {
                let callee = self.graphql_import("GraphQLNonNull");
                let of_type = self.type_reference(of_type);
                self.ts.new_expression(callee, vec![of_type])
            }
            GraphQLType::List(of_type) => {
                let callee = self.graphql_import("GraphQLList");
                let of_type = self.type_reference(of_type);
                self.ts.new_expression(callee, vec![of_type])
            }
            GraphQLType::Named(t) => self.named_type_reference(*t),
        }
    }

    /// PORT: The part of `typeReference` which handles named types, which are
    /// referenced by `TypeId`.
    fn named_type_reference(&mut self, id: TypeId) -> Expression<'a> {
        let schema = self.schema;
        match &schema[id] {
            GraphQLNamedType::Interface(_) => self.interface_type(id),
            GraphQLNamedType::Object(_) => self.object_type(id),
            GraphQLNamedType::Union(_) => self.union_type(id),
            GraphQLNamedType::InputObject(t) => self.input_type(t),
            GraphQLNamedType::Enum(t) => self.enum_type(t),
            GraphQLNamedType::Scalar(t) => match t.name {
                "String" => self.graphql_import("GraphQLString"),
                "Int" => self.graphql_import("GraphQLInt"),
                "Float" => self.graphql_import("GraphQLFloat"),
                "Boolean" => self.graphql_import("GraphQLBoolean"),
                "ID" => self.graphql_import("GraphQLID"),
                _ => self.custom_scalar_type(t),
            },
        }
    }

    fn resolve_type_function_declaration(&self) -> Statement<'a> {
        let ts = &self.ts;
        let get_prototype_of = |arg: &str| {
            ts.call(
                ts.property_access(ts.identifier("Object"), "getPrototypeOf"),
                vec![ts.identifier(arg)],
            )
        };
        Statement::from(ts.function(
            "resolveType",
            false,
            None,
            vec![ts.param("obj", Some(ts.type_reference("any", vec![])))],
            Some(TSType::new_ts_string_keyword(SPAN, ts)),
            ts.block(vec![
                Statement::new_if_statement(
                    SPAN,
                    Expression::new_binary_expression(
                        SPAN,
                        Expression::new_unary_expression(
                            SPAN,
                            UnaryOperator::Typeof,
                            ts.property_access(ts.identifier("obj"), "__typename"),
                            ts,
                        ),
                        BinaryOperator::StrictEquality,
                        ts.string_literal("string"),
                        ts,
                    ),
                    ts.block_statement(vec![
                        ts.return_statement(ts.property_access(ts.identifier("obj"), "__typename")),
                    ]),
                    None,
                    ts,
                ),
                ts.variable_statement(
                    VariableDeclarationKind::Let,
                    "prototype",
                    None,
                    get_prototype_of("obj"),
                ),
                Statement::new_while_statement(
                    SPAN,
                    ts.identifier("prototype"),
                    ts.block_statement(vec![
                        ts.variable_statement(
                            VariableDeclarationKind::Const,
                            "name",
                            None,
                            ts.call(
                                ts.property_access(ts.identifier("typeNameMap"), "get"),
                                vec![ts.property_access(ts.identifier("prototype"), "constructor")],
                            ),
                        ),
                        Statement::new_if_statement(
                            SPAN,
                            Expression::new_binary_expression(
                                SPAN,
                                ts.identifier("name"),
                                BinaryOperator::Inequality,
                                Expression::new_null_literal(SPAN, ts),
                                ts,
                            ),
                            ts.block_statement(vec![ts.return_statement(ts.identifier("name"))]),
                            None,
                            ts,
                        ),
                        Statement::new_expression_statement(
                            SPAN,
                            Expression::new_assignment_expression(
                                SPAN,
                                AssignmentOperator::Assign,
                                AssignmentTarget::new_assignment_target_identifier(
                                    SPAN,
                                    "prototype",
                                    ts,
                                ),
                                get_prototype_of("prototype"),
                                ts,
                            ),
                            ts,
                        ),
                    ]),
                    ts,
                ),
                Statement::new_throw_statement(
                    SPAN,
                    ts.new_expression(
                        ts.identifier("Error"),
                        vec![ts.string_literal("Cannot find type name.")],
                    ),
                    ts,
                ),
            ]),
        ))
    }

    fn print(mut self) -> String {
        if !self.type_name_mappings.is_empty() {
            let statement = self.ts.variable_statement(
                VariableDeclarationKind::Const,
                "typeNameMap",
                None,
                self.ts.new_expression(self.ts.identifier("Map"), vec![]),
            );
            self.ts.add_statement(statement);

            let mut type_name_entries: Vec<(&str, String)> =
                std::mem::take(&mut self.type_name_mappings)
                    .into_iter()
                    .collect();
            type_name_entries.sort_by(|(a_type_name, _), (b_type_name, _)| {
                natural_compare(a_type_name, b_type_name)
            });

            for (type_name, class_name) in type_name_entries {
                let statement = Statement::new_expression_statement(
                    SPAN,
                    self.ts.call(
                        self.ts
                            .property_access(self.ts.identifier("typeNameMap"), "set"),
                        vec![
                            self.ts.identifier(&class_name),
                            self.ts.string_literal(type_name),
                        ],
                    ),
                    &self.ts,
                );
                self.ts.add_statement(statement);
            }
            let statement = self.resolve_type_function_declaration();
            self.ts.add_statement(statement);
        }

        self.ts.print()
    }
}
