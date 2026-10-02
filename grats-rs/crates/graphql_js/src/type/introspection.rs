//! Port of graphql-js `type/introspection.ts`.
//!
//! PORT: Only the introspection types' definitions are ported, since Grats
//! never executes queries. Their resolvers, and the meta field definitions
//! (`__schema`, `__type`, `__typename`), are omitted.

use indexmap::IndexMap;

use crate::js_value::Value;
use crate::r#type::definition::{
    GraphQLArgument, GraphQLEnumType, GraphQLEnumValue, GraphQLField, GraphQLNamedType,
    GraphQLObjectType, GraphQLType, TypeId,
};
use crate::r#type::scalars::{GRAPHQL_BOOLEAN, GRAPHQL_STRING};

/// PORT: graphql-js exports the introspection types as global objects. Here
/// they are the ids at which every `TypeArena` holds them, following the
/// specified scalars.
pub const __SCHEMA: TypeId = TypeId(5);
pub const __DIRECTIVE: TypeId = TypeId(6);
pub const __DIRECTIVE_LOCATION: TypeId = TypeId(7);
pub const __TYPE: TypeId = TypeId(8);
pub const __FIELD: TypeId = TypeId(9);
pub const __INPUT_VALUE: TypeId = TypeId(10);
pub const __ENUM_VALUE: TypeId = TypeId(11);
pub const __TYPE_KIND: TypeId = TypeId(12);

fn __schema() -> GraphQLNamedType<'static> {
    object_type(
        "__Schema",
        "A GraphQL Schema defines the capabilities of a GraphQL server. It exposes all available types and directives on the server, as well as the entry points for query, mutation, and subscription operations.",
        vec![
            field("description", None, named(GRAPHQL_STRING), Vec::new()),
            field(
                "types",
                Some("A list of all types supported by this server."),
                non_null(list(non_null(named(__TYPE)))),
                Vec::new(),
            ),
            field(
                "queryType",
                Some("The type that query operations will be rooted at."),
                non_null(named(__TYPE)),
                Vec::new(),
            ),
            field(
                "mutationType",
                Some(
                    "If this server supports mutation, the type that mutation operations will be rooted at.",
                ),
                named(__TYPE),
                Vec::new(),
            ),
            field(
                "subscriptionType",
                Some(
                    "If this server support subscription, the type that subscription operations will be rooted at.",
                ),
                named(__TYPE),
                Vec::new(),
            ),
            field(
                "directives",
                Some("A list of all directives supported by this server."),
                non_null(list(non_null(named(__DIRECTIVE)))),
                Vec::new(),
            ),
        ],
    )
}

fn __directive() -> GraphQLNamedType<'static> {
    object_type(
        "__Directive",
        "A Directive provides a way to describe alternate runtime execution and type validation behavior in a GraphQL document.\n\nIn some cases, you need to provide options to alter GraphQL's execution behavior in ways field arguments will not suffice, such as conditionally including or skipping a field. Directives provide this by describing additional information to the executor.",
        vec![
            field("name", None, non_null(named(GRAPHQL_STRING)), Vec::new()),
            field("description", None, named(GRAPHQL_STRING), Vec::new()),
            field(
                "isRepeatable",
                None,
                non_null(named(GRAPHQL_BOOLEAN)),
                Vec::new(),
            ),
            field(
                "locations",
                None,
                non_null(list(non_null(named(__DIRECTIVE_LOCATION)))),
                Vec::new(),
            ),
            field(
                "args",
                None,
                non_null(list(non_null(named(__INPUT_VALUE)))),
                vec![include_deprecated_arg()],
            ),
        ],
    )
}

fn __directive_location() -> GraphQLNamedType<'static> {
    enum_type(
        "__DirectiveLocation",
        "A Directive can be adjacent to many parts of the GraphQL language, a __DirectiveLocation describes one such possible adjacencies.",
        &[
            ("QUERY", "Location adjacent to a query operation."),
            ("MUTATION", "Location adjacent to a mutation operation."),
            (
                "SUBSCRIPTION",
                "Location adjacent to a subscription operation.",
            ),
            ("FIELD", "Location adjacent to a field."),
            (
                "FRAGMENT_DEFINITION",
                "Location adjacent to a fragment definition.",
            ),
            ("FRAGMENT_SPREAD", "Location adjacent to a fragment spread."),
            (
                "INLINE_FRAGMENT",
                "Location adjacent to an inline fragment.",
            ),
            (
                "VARIABLE_DEFINITION",
                "Location adjacent to a variable definition.",
            ),
            ("SCHEMA", "Location adjacent to a schema definition."),
            ("SCALAR", "Location adjacent to a scalar definition."),
            ("OBJECT", "Location adjacent to an object type definition."),
            (
                "FIELD_DEFINITION",
                "Location adjacent to a field definition.",
            ),
            (
                "ARGUMENT_DEFINITION",
                "Location adjacent to an argument definition.",
            ),
            ("INTERFACE", "Location adjacent to an interface definition."),
            ("UNION", "Location adjacent to a union definition."),
            ("ENUM", "Location adjacent to an enum definition."),
            (
                "ENUM_VALUE",
                "Location adjacent to an enum value definition.",
            ),
            (
                "INPUT_OBJECT",
                "Location adjacent to an input object type definition.",
            ),
            (
                "INPUT_FIELD_DEFINITION",
                "Location adjacent to an input object field definition.",
            ),
        ],
    )
}

fn __type() -> GraphQLNamedType<'static> {
    object_type(
        "__Type",
        "The fundamental unit of any GraphQL Schema is the type. There are many kinds of types in GraphQL as represented by the `__TypeKind` enum.\n\nDepending on the kind of a type, certain fields describe information about that type. Scalar types provide no information beyond a name, description and optional `specifiedByURL`, while Enum types provide their values. Object and Interface types provide the fields they describe. Abstract types, Union and Interface, provide the Object types possible at runtime. List and NonNull types compose other types.",
        vec![
            field("kind", None, non_null(named(__TYPE_KIND)), Vec::new()),
            field("name", None, named(GRAPHQL_STRING), Vec::new()),
            field("description", None, named(GRAPHQL_STRING), Vec::new()),
            field("specifiedByURL", None, named(GRAPHQL_STRING), Vec::new()),
            field(
                "fields",
                None,
                list(non_null(named(__FIELD))),
                vec![include_deprecated_arg()],
            ),
            field(
                "interfaces",
                None,
                list(non_null(named(__TYPE))),
                Vec::new(),
            ),
            field(
                "possibleTypes",
                None,
                list(non_null(named(__TYPE))),
                Vec::new(),
            ),
            field(
                "enumValues",
                None,
                list(non_null(named(__ENUM_VALUE))),
                vec![include_deprecated_arg()],
            ),
            field(
                "inputFields",
                None,
                list(non_null(named(__INPUT_VALUE))),
                vec![include_deprecated_arg()],
            ),
            field("ofType", None, named(__TYPE), Vec::new()),
            field("isOneOf", None, named(GRAPHQL_BOOLEAN), Vec::new()),
        ],
    )
}

fn __field() -> GraphQLNamedType<'static> {
    object_type(
        "__Field",
        "Object and Interface types are described by a list of Fields, each of which has a name, potentially a list of arguments, and a return type.",
        vec![
            field("name", None, non_null(named(GRAPHQL_STRING)), Vec::new()),
            field("description", None, named(GRAPHQL_STRING), Vec::new()),
            field(
                "args",
                None,
                non_null(list(non_null(named(__INPUT_VALUE)))),
                vec![include_deprecated_arg()],
            ),
            field("type", None, non_null(named(__TYPE)), Vec::new()),
            field(
                "isDeprecated",
                None,
                non_null(named(GRAPHQL_BOOLEAN)),
                Vec::new(),
            ),
            field("deprecationReason", None, named(GRAPHQL_STRING), Vec::new()),
        ],
    )
}

fn __input_value() -> GraphQLNamedType<'static> {
    object_type(
        "__InputValue",
        "Arguments provided to Fields or Directives and the input fields of an InputObject are represented as Input Values which describe their type and optionally a default value.",
        vec![
            field("name", None, non_null(named(GRAPHQL_STRING)), Vec::new()),
            field("description", None, named(GRAPHQL_STRING), Vec::new()),
            field("type", None, non_null(named(__TYPE)), Vec::new()),
            field(
                "defaultValue",
                Some(
                    "A GraphQL-formatted string representing the default value for this input value.",
                ),
                named(GRAPHQL_STRING),
                Vec::new(),
            ),
            field(
                "isDeprecated",
                None,
                non_null(named(GRAPHQL_BOOLEAN)),
                Vec::new(),
            ),
            field("deprecationReason", None, named(GRAPHQL_STRING), Vec::new()),
        ],
    )
}

fn __enum_value() -> GraphQLNamedType<'static> {
    object_type(
        "__EnumValue",
        "One possible value for a given Enum. Enum values are unique values, not a placeholder for a string or numeric value. However an Enum value is returned in a JSON response as a string.",
        vec![
            field("name", None, non_null(named(GRAPHQL_STRING)), Vec::new()),
            field("description", None, named(GRAPHQL_STRING), Vec::new()),
            field(
                "isDeprecated",
                None,
                non_null(named(GRAPHQL_BOOLEAN)),
                Vec::new(),
            ),
            field("deprecationReason", None, named(GRAPHQL_STRING), Vec::new()),
        ],
    )
}

fn __type_kind() -> GraphQLNamedType<'static> {
    enum_type(
        "__TypeKind",
        "An enum describing what kind of type a given `__Type` is.",
        &[
            ("SCALAR", "Indicates this type is a scalar."),
            (
                "OBJECT",
                "Indicates this type is an object. `fields` and `interfaces` are valid fields.",
            ),
            (
                "INTERFACE",
                "Indicates this type is an interface. `fields`, `interfaces`, and `possibleTypes` are valid fields.",
            ),
            (
                "UNION",
                "Indicates this type is a union. `possibleTypes` is a valid field.",
            ),
            (
                "ENUM",
                "Indicates this type is an enum. `enumValues` is a valid field.",
            ),
            (
                "INPUT_OBJECT",
                "Indicates this type is an input object. `inputFields` is a valid field.",
            ),
            (
                "LIST",
                "Indicates this type is a list. `ofType` is a valid field.",
            ),
            (
                "NON_NULL",
                "Indicates this type is a non-null. `ofType` is a valid field.",
            ),
        ],
    )
}

/// PORT: The ids of these types are `INTROSPECTION_TYPES`, in the same order.
pub fn introspection_types() -> [GraphQLNamedType<'static>; 8] {
    [
        __schema(),
        __directive(),
        __directive_location(),
        __type(),
        __field(),
        __input_value(),
        __enum_value(),
        __type_kind(),
    ]
}

pub const INTROSPECTION_TYPES: [TypeId; 8] = [
    __SCHEMA,
    __DIRECTIVE,
    __DIRECTIVE_LOCATION,
    __TYPE,
    __FIELD,
    __INPUT_VALUE,
    __ENUM_VALUE,
    __TYPE_KIND,
];

/// PORT: graphql-js compares the type's name against the introspection types'
/// names. A schema always holds the introspection types at their own ids, and
/// resolves their names to them, so comparing ids is equivalent.
pub fn is_introspection_type(r#type: TypeId) -> bool {
    INTROSPECTION_TYPES.contains(&r#type)
}

fn named(id: TypeId) -> GraphQLType {
    GraphQLType::Named(id)
}

fn list(of_type: GraphQLType) -> GraphQLType {
    GraphQLType::List(Box::new(of_type))
}

fn non_null(of_type: GraphQLType) -> GraphQLType {
    GraphQLType::NonNull(Box::new(of_type))
}

fn object_type(
    name: &'static str,
    description: &'static str,
    fields: Vec<GraphQLField<'static>>,
) -> GraphQLNamedType<'static> {
    GraphQLNamedType::Object(GraphQLObjectType {
        name,
        description: Some(description),
        fields: fields
            .into_iter()
            .map(|field| (field.name, field))
            .collect::<IndexMap<_, _>>(),
        interfaces: Vec::new(),
        ast_node: None,
        extension_ast_nodes: Vec::new(),
    })
}

fn field(
    name: &'static str,
    description: Option<&'static str>,
    r#type: GraphQLType,
    args: Vec<GraphQLArgument<'static>>,
) -> GraphQLField<'static> {
    GraphQLField {
        name,
        description,
        r#type,
        args,
        deprecation_reason: None,
        ast_node: None,
    }
}

fn include_deprecated_arg() -> GraphQLArgument<'static> {
    GraphQLArgument {
        name: "includeDeprecated",
        description: None,
        r#type: named(GRAPHQL_BOOLEAN),
        default_value: Some(Value::Boolean(false)),
        deprecation_reason: None,
        ast_node: None,
    }
}

fn enum_type(
    name: &'static str,
    description: &'static str,
    values: &[(&'static str, &'static str)],
) -> GraphQLNamedType<'static> {
    GraphQLNamedType::Enum(GraphQLEnumType {
        name,
        description: Some(description),
        values: values
            .iter()
            .map(|&(name, description)| GraphQLEnumValue {
                name,
                description: Some(description),
                deprecation_reason: None,
                ast_node: None,
            })
            .collect(),
        ast_node: None,
        extension_ast_nodes: Vec::new(),
    })
}
