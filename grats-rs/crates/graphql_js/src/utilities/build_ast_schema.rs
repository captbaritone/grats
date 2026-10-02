//! Port of graphql-js `utilities/buildASTSchema.ts`.

use crate::language::ast::DocumentNode;
use crate::r#type::definition::TypeArena;
use crate::r#type::directives::specified_directives;
use crate::r#type::schema::{GraphQLSchema, GraphQLSchemaConfig};
use crate::utilities::extend_schema::extend_schema_impl;

/// This takes the ast of a schema document produced by the parse function in
/// src/language/parser.js.
///
/// If no schema definition is provided, then it will look for types named Query,
/// Mutation and Subscription.
///
/// Given that AST it constructs a GraphQLSchema. The resulting schema
/// has no resolve methods, so execution will use default resolvers.
///
/// PORT: Only the `assumeValidSDL` path is ported. Grats validates the SDL
/// before building the schema.
pub fn build_ast_schema<'a>(document_ast: &'a DocumentNode) -> GraphQLSchema<'a> {
    let empty_schema_config = GraphQLSchemaConfig {
        description: None,
        query: None,
        mutation: None,
        subscription: None,
        types: Vec::new(),
        directives: Some(Vec::new()),
        ast_node: None,
        extension_ast_nodes: Vec::new(),
        arena: TypeArena::new(),
    };
    let mut config = extend_schema_impl(empty_schema_config, document_ast);

    if config.ast_node.is_none() {
        for &r#type in &config.types {
            match config.arena[r#type].name() {
                // Note: While this could make early assertions to get the correctly
                // typed values below, that would throw immediately while type system
                // validation with validateSchema() will produce more actionable results.
                "Query" => config.query = Some(r#type),
                "Mutation" => config.mutation = Some(r#type),
                "Subscription" => config.subscription = Some(r#type),
                _ => {}
            }
        }
    }

    let mut directives = config.directives.take().unwrap_or_default();
    // If specified directives were not explicitly declared, add them.
    let missing_directives: Vec<_> = specified_directives()
        .into_iter()
        .filter(|std_directive| {
            directives
                .iter()
                .all(|directive| directive.name != std_directive.name)
        })
        .cloned()
        .collect();
    directives.extend(missing_directives);

    GraphQLSchema::new(GraphQLSchemaConfig {
        directives: Some(directives),
        ..config
    })
}

#[cfg(test)]
mod tests {
    use serde_json::{Value as Json, json};

    use super::*;
    use crate::js_value::Value;
    use crate::r#type::definition::GraphQLNamedType;
    use crate::r#type::introspection::INTROSPECTION_TYPES;
    use crate::r#type::scalars::SPECIFIED_SCALAR_TYPES;

    fn name(value: &str) -> Json {
        json!({ "value": value })
    }

    fn named(type_name: &str) -> Json {
        json!({ "kind": "NamedType", "name": name(type_name) })
    }

    fn field(field_name: &str, r#type: Json) -> Json {
        json!({ "name": name(field_name), "type": r#type })
    }

    fn object(type_name: &str, fields: Vec<Json>) -> Json {
        json!({ "kind": "ObjectTypeDefinition", "name": name(type_name), "fields": fields })
    }

    fn document(definitions: Vec<Json>) -> DocumentNode {
        serde_json::from_value(json!({ "definitions": definitions })).unwrap()
    }

    fn type_names<'a>(
        schema: &GraphQLSchema<'a>,
        types: &[crate::r#type::definition::TypeId],
    ) -> Vec<&'a str> {
        types.iter().map(|&r#type| schema[r#type].name()).collect()
    }

    fn input_field_default(
        schema: &GraphQLSchema,
        type_name: &str,
        field_name: &str,
    ) -> Option<Value> {
        let GraphQLNamedType::InputObject(t) = &schema[schema.get_type(type_name).unwrap()] else {
            panic!("Expected an input object type");
        };
        t.get_fields()[field_name].default_value.clone()
    }

    fn object_value(fields: &[(&str, Value)]) -> Value {
        Value::Object(
            fields
                .iter()
                .map(|(key, value)| (key.to_string(), value.clone()))
                .collect(),
        )
    }

    #[test]
    fn builtin_types_are_at_their_ids() {
        let arena = TypeArena::new();
        let names: Vec<_> = SPECIFIED_SCALAR_TYPES
            .into_iter()
            .chain(INTROSPECTION_TYPES)
            .map(|r#type| arena[r#type].name())
            .collect();
        assert_eq!(
            names,
            [
                "String",
                "Int",
                "Float",
                "Boolean",
                "ID",
                "__Schema",
                "__Directive",
                "__DirectiveLocation",
                "__Type",
                "__Field",
                "__InputValue",
                "__EnumValue",
                "__TypeKind",
            ]
        );
    }

    /// The expected values are graphql-js's output for the same document.
    #[test]
    fn orders_types_and_directives_like_graphql_js() {
        let doc = document(vec![
            object(
                "Query",
                vec![field("b", named("B")), field("i", named("I"))],
            ),
            json!({
                "kind": "InterfaceTypeDefinition",
                "name": name("I"),
                "fields": [field("x", named("X"))],
            }),
            json!({
                "kind": "ObjectTypeDefinition",
                "name": name("B"),
                "interfaces": [named("I")],
                "fields": [
                    field("x", named("X")),
                    {
                        "name": name("f"),
                        "arguments": [{ "name": name("a"), "type": named("InArg") }],
                        "type": named("String"),
                    },
                ],
            }),
            object("X", vec![field("s", named("String"))]),
            json!({
                "kind": "InputObjectTypeDefinition",
                "name": name("InArg"),
                "fields": [{ "name": name("e"), "type": named("E") }],
            }),
            json!({ "kind": "EnumTypeDefinition", "name": name("E"), "values": [{ "name": name("A") }] }),
            json!({ "kind": "UnionTypeDefinition", "name": name("U"), "types": [named("B")] }),
            json!({
                "kind": "DirectiveDefinition",
                "name": name("d"),
                "arguments": [{ "name": name("a"), "type": named("DArg") }],
                "locations": [name("FIELD")],
            }),
            json!({
                "kind": "InputObjectTypeDefinition",
                "name": name("DArg"),
                "fields": [{ "name": name("i"), "type": named("Int") }],
            }),
            object("Query2", vec![field("id", named("ID"))]),
        ]);
        let schema = build_ast_schema(&doc);
        let type_map: Vec<_> = schema.get_type_map().keys().copied().collect();
        assert_eq!(
            type_map,
            [
                "Query",
                "I",
                "B",
                "String",
                "X",
                "InArg",
                "E",
                "U",
                "DArg",
                "Int",
                "Query2",
                "ID",
                "Boolean",
                "__Schema",
                "__Type",
                "__TypeKind",
                "__Field",
                "__InputValue",
                "__EnumValue",
                "__Directive",
                "__DirectiveLocation",
            ]
        );
        let directives: Vec<_> = schema.get_directives().iter().map(|d| d.name).collect();
        assert_eq!(
            directives,
            ["d", "include", "skip", "deprecated", "specifiedBy", "oneOf"]
        );

        let i = schema.get_type("I").unwrap();
        assert_eq!(type_names(&schema, schema.get_possible_types(i)), ["B"]);
        let u = schema.get_type("U").unwrap();
        assert_eq!(type_names(&schema, schema.get_possible_types(u)), ["B"]);
        assert!(schema.is_sub_type(i, schema.get_type("B").unwrap()));
        assert!(!schema.is_sub_type(i, schema.get_type("X").unwrap()));

        assert_eq!(schema.get_query_type(), schema.get_type("Query"));
        assert_eq!(schema.get_mutation_type(), None);
    }

    #[test]
    fn root_types_come_from_the_schema_definition_and_extensions() {
        let operation = |operation: &str, type_name: &str| json!({ "operation": operation, "type": named(type_name) });
        let doc = document(vec![
            object("Query", vec![field("a", named("Int"))]),
            object("Root", vec![field("a", named("Int"))]),
            object("Mutation", vec![field("a", named("Int"))]),
            json!({ "kind": "SchemaDefinition", "operationTypes": [operation("query", "Root")] }),
            json!({ "kind": "SchemaExtension", "operationTypes": [operation("subscription", "Query")] }),
        ]);
        let schema = build_ast_schema(&doc);
        assert_eq!(schema.get_query_type(), schema.get_type("Root"));
        // With a schema definition, types aren't found by name.
        assert_eq!(schema.get_mutation_type(), None);
        assert_eq!(schema.get_subscription_type(), schema.get_type("Query"));
        assert_eq!(schema.extension_ast_nodes.len(), 1);
    }

    #[test]
    fn coerces_default_values_of_input_objects_defined_later() {
        // input A { b: B = { x: 1 } }
        // input B { x: Int, y: [Int] = 2 }
        // type Query { f(a: A = {}): Int }
        let int_value = |value: &str| json!({ "kind": "IntValue", "value": value });
        let doc = document(vec![
            json!({
                "kind": "InputObjectTypeDefinition",
                "name": name("A"),
                "fields": [{
                    "name": name("b"),
                    "type": named("B"),
                    "defaultValue": {
                        "kind": "ObjectValue",
                        "fields": [{ "name": name("x"), "value": int_value("1") }],
                    },
                }],
            }),
            json!({
                "kind": "InputObjectTypeDefinition",
                "name": name("B"),
                "fields": [
                    { "name": name("x"), "type": named("Int") },
                    {
                        "name": name("y"),
                        "type": { "kind": "ListType", "type": named("Int") },
                        "defaultValue": int_value("2"),
                    },
                ],
            }),
            object(
                "Query",
                vec![json!({
                    "name": name("f"),
                    "arguments": [{
                        "name": name("a"),
                        "type": named("A"),
                        "defaultValue": { "kind": "ObjectValue", "fields": [] },
                    }],
                    "type": named("Int"),
                })],
            ),
        ]);
        let schema = build_ast_schema(&doc);
        let b = object_value(&[
            ("x", Value::Number(1.0)),
            ("y", Value::List(vec![Value::Number(2.0)])),
        ]);
        assert_eq!(input_field_default(&schema, "A", "b"), Some(b.clone()));
        let GraphQLNamedType::Object(query) = &schema[schema.get_query_type().unwrap()] else {
            panic!("Expected an object type");
        };
        assert_eq!(
            query.get_fields()["f"].args[0].default_value,
            Some(object_value(&[("b", b)]))
        );
    }

    #[test]
    fn invalid_default_values_are_undefined() {
        // input A @oneOf { a: Int, b: Int }
        // input B { a: A = { a: 1, b: 2 }, i: Int = "x", n: Int = null }
        let doc = document(vec![
            json!({
                "kind": "InputObjectTypeDefinition",
                "name": name("A"),
                "directives": [{ "name": name("oneOf") }],
                "fields": [
                    { "name": name("a"), "type": named("Int") },
                    { "name": name("b"), "type": named("Int") },
                ],
            }),
            json!({
                "kind": "InputObjectTypeDefinition",
                "name": name("B"),
                "fields": [
                    {
                        "name": name("a"),
                        "type": named("A"),
                        "defaultValue": {
                            "kind": "ObjectValue",
                            "fields": [
                                { "name": name("a"), "value": { "kind": "IntValue", "value": "1" } },
                                { "name": name("b"), "value": { "kind": "IntValue", "value": "2" } },
                            ],
                        },
                    },
                    {
                        "name": name("i"),
                        "type": named("Int"),
                        "defaultValue": { "kind": "StringValue", "value": "x" },
                    },
                    {
                        "name": name("n"),
                        "type": named("Int"),
                        "defaultValue": { "kind": "NullValue" },
                    },
                ],
            }),
        ]);
        let schema = build_ast_schema(&doc);
        let GraphQLNamedType::InputObject(a) = &schema[schema.get_type("A").unwrap()] else {
            panic!("Expected an input object type");
        };
        assert!(a.is_one_of);
        assert_eq!(input_field_default(&schema, "B", "a"), None);
        assert_eq!(input_field_default(&schema, "B", "i"), None);
        assert_eq!(input_field_default(&schema, "B", "n"), Some(Value::Null));
    }

    #[test]
    #[should_panic(expected = "depend on themselves")]
    fn panics_on_default_values_that_depend_on_themselves() {
        // input A { a: A = {} }
        let doc = document(vec![json!({
            "kind": "InputObjectTypeDefinition",
            "name": name("A"),
            "fields": [{
                "name": name("a"),
                "type": named("A"),
                "defaultValue": { "kind": "ObjectValue", "fields": [] },
            }],
        })]);
        build_ast_schema(&doc);
    }

    #[test]
    fn reads_deprecation_and_specified_by() {
        let deprecated = |reason: Option<&str>| match reason {
            Some(reason) => json!({
                "name": name("deprecated"),
                "arguments": [{ "name": name("reason"), "value": { "kind": "StringValue", "value": reason } }],
            }),
            None => json!({ "name": name("deprecated") }),
        };
        let doc = document(vec![
            json!({
                "kind": "ObjectTypeDefinition",
                "name": name("Query"),
                "fields": [
                    { "name": name("a"), "type": named("Int"), "directives": [deprecated(None)] },
                    { "name": name("b"), "type": named("Int"), "directives": [deprecated(Some("Use a"))] },
                    { "name": name("c"), "type": named("Int") },
                ],
            }),
            json!({
                "kind": "ScalarTypeDefinition",
                "name": name("Date"),
                "directives": [{
                    "name": name("specifiedBy"),
                    "arguments": [{ "name": name("url"), "value": { "kind": "StringValue", "value": "https://example.com" } }],
                }],
            }),
        ]);
        let schema = build_ast_schema(&doc);
        let GraphQLNamedType::Object(query) = &schema[schema.get_query_type().unwrap()] else {
            panic!("Expected an object type");
        };
        let reasons: Vec<_> = query
            .get_fields()
            .values()
            .map(|field| field.deprecation_reason.as_deref())
            .collect();
        assert_eq!(reasons, [Some("No longer supported"), Some("Use a"), None]);
        let GraphQLNamedType::Scalar(date) = &schema[schema.get_type("Date").unwrap()] else {
            panic!("Expected a scalar type");
        };
        assert_eq!(
            date.specified_by_url.as_deref(),
            Some("https://example.com")
        );
    }

    #[test]
    fn merges_extensions_of_the_same_kind() {
        let doc = document(vec![
            json!({ "kind": "ObjectTypeExtension", "name": name("Query"), "fields": [field("b", named("Int"))] }),
            object("Query", vec![field("a", named("Int"))]),
            json!({ "kind": "InputObjectTypeExtension", "name": name("Query"), "fields": [{ "name": name("c"), "type": named("Int") }] }),
            json!({ "kind": "EnumTypeDefinition", "name": name("E"), "values": [{ "name": name("A") }] }),
            json!({ "kind": "EnumTypeExtension", "name": name("E"), "values": [{ "name": name("B") }, { "name": name("A") }] }),
        ]);
        let schema = build_ast_schema(&doc);
        let GraphQLNamedType::Object(query) = &schema[schema.get_query_type().unwrap()] else {
            panic!("Expected an object type");
        };
        assert_eq!(
            query.get_fields().keys().copied().collect::<Vec<_>>(),
            ["a", "b"]
        );
        assert_eq!(query.extension_ast_nodes.len(), 1);
        let GraphQLNamedType::Enum(e) = &schema[schema.get_type("E").unwrap()] else {
            panic!("Expected an enum type");
        };
        let values: Vec<_> = e.get_values().iter().map(|value| value.name).collect();
        assert_eq!(values, ["A", "B"]);
    }

    #[test]
    fn later_definitions_replace_earlier_ones_in_place() {
        let doc = document(vec![
            object("Query", vec![field("a", named("Int"))]),
            object("Other", vec![field("a", named("Int"))]),
            object("Query", vec![field("b", named("String"))]),
            // Redefining a builtin type keeps the builtin type.
            json!({ "kind": "ScalarTypeDefinition", "name": name("String"), "description": { "value": "Mine" } }),
        ]);
        let schema = build_ast_schema(&doc);
        let type_map: Vec<_> = schema.get_type_map().keys().copied().collect();
        assert_eq!(type_map[..4], ["Query", "Other", "Int", "String"]);
        let GraphQLNamedType::Object(query) = &schema[schema.get_query_type().unwrap()] else {
            panic!("Expected an object type");
        };
        assert_eq!(
            query.get_fields().keys().copied().collect::<Vec<_>>(),
            ["b"]
        );
        assert_ne!(
            schema[schema.get_type("String").unwrap()].description(),
            Some("Mine")
        );
    }

    #[test]
    #[should_panic(expected = "Unknown type: \"Missing\".")]
    fn panics_on_unknown_types() {
        build_ast_schema(&document(vec![object(
            "Query",
            vec![field("a", named("Missing"))],
        )]));
    }

    #[test]
    #[should_panic(expected = "Enum values cannot be named: true")]
    fn panics_on_invalid_enum_value_names() {
        build_ast_schema(&document(vec![json!({
            "kind": "EnumTypeDefinition",
            "name": name("E"),
            "values": [{ "name": name("true") }],
        })]));
    }

    #[test]
    fn an_empty_document_has_only_builtin_types() {
        let doc = document(vec![]);
        let schema = build_ast_schema(&doc);
        assert_eq!(schema.get_type_map().len(), 10);
        assert_eq!(schema.get_directives().len(), 5);
        assert_eq!(schema.get_query_type(), None);
    }
}
