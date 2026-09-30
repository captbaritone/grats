//! Port of graphql-js `type/directives.ts`.

use std::sync::LazyLock;

use crate::js_value::Value;
use crate::language::ast::DirectiveDefinitionNode;
use crate::language::directive_location;
use crate::r#type::definition::{GraphQLArgument, GraphQLType};
use crate::r#type::scalars::{GRAPHQL_BOOLEAN, GRAPHQL_STRING};

/// Directives are used by the GraphQL runtime as a way of modifying execution
/// behavior. Type system creators will usually not create these directly.
#[derive(Debug, Clone)]
pub struct GraphQLDirective<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub locations: Vec<&'a str>,
    pub args: Vec<GraphQLArgument<'a>>,
    pub is_repeatable: bool,
    pub ast_node: Option<&'a DirectiveDefinitionNode>,
}

fn argument(
    name: &'static str,
    r#type: GraphQLType,
    description: &'static str,
    default_value: Option<Value>,
) -> GraphQLArgument<'static> {
    GraphQLArgument {
        name,
        description: Some(description),
        r#type,
        default_value,
        deprecation_reason: None,
        ast_node: None,
    }
}

fn non_null_boolean() -> GraphQLType {
    GraphQLType::NonNull(Box::new(GraphQLType::Named(GRAPHQL_BOOLEAN)))
}

/// Used to conditionally include fields or fragments.
pub static GRAPHQL_INCLUDE_DIRECTIVE: LazyLock<GraphQLDirective<'static>> = LazyLock::new(|| {
    GraphQLDirective {
        name: "include",
        description: Some(
            "Directs the executor to include this field or fragment only when the `if` argument is true.",
        ),
        locations: vec![
            directive_location::FIELD,
            directive_location::FRAGMENT_SPREAD,
            directive_location::INLINE_FRAGMENT,
        ],
        args: vec![argument(
            "if",
            non_null_boolean(),
            "Included when true.",
            None,
        )],
        is_repeatable: false,
        ast_node: None,
    }
});

/// Used to conditionally skip (exclude) fields or fragments.
pub static GRAPHQL_SKIP_DIRECTIVE: LazyLock<GraphQLDirective<'static>> =
    LazyLock::new(|| GraphQLDirective {
        name: "skip",
        description: Some(
            "Directs the executor to skip this field or fragment when the `if` argument is true.",
        ),
        locations: vec![
            directive_location::FIELD,
            directive_location::FRAGMENT_SPREAD,
            directive_location::INLINE_FRAGMENT,
        ],
        args: vec![argument(
            "if",
            non_null_boolean(),
            "Skipped when true.",
            None,
        )],
        is_repeatable: false,
        ast_node: None,
    });

/// Constant string used for default reason for a deprecation.
pub const DEFAULT_DEPRECATION_REASON: &str = "No longer supported";

/// Used to declare element of a GraphQL schema as deprecated.
pub static GRAPHQL_DEPRECATED_DIRECTIVE: LazyLock<GraphQLDirective<'static>> = LazyLock::new(
    || GraphQLDirective {
        name: "deprecated",
        description: Some("Marks an element of a GraphQL schema as no longer supported."),
        locations: vec![
            directive_location::FIELD_DEFINITION,
            directive_location::ARGUMENT_DEFINITION,
            directive_location::INPUT_FIELD_DEFINITION,
            directive_location::ENUM_VALUE,
        ],
        args: vec![argument(
            "reason",
            GraphQLType::Named(GRAPHQL_STRING),
            "Explains why this element was deprecated, usually also including a suggestion for how to access supported similar data. Formatted using the Markdown syntax, as specified by [CommonMark](https://commonmark.org/).",
            Some(Value::String(DEFAULT_DEPRECATION_REASON.to_string())),
        )],
        is_repeatable: false,
        ast_node: None,
    },
);

/// Used to provide a URL for specifying the behavior of custom scalar definitions.
pub static GRAPHQL_SPECIFIED_BY_DIRECTIVE: LazyLock<GraphQLDirective<'static>> =
    LazyLock::new(|| GraphQLDirective {
        name: "specifiedBy",
        description: Some("Exposes a URL that specifies the behavior of this scalar."),
        locations: vec![directive_location::SCALAR],
        args: vec![argument(
            "url",
            GraphQLType::NonNull(Box::new(GraphQLType::Named(GRAPHQL_STRING))),
            "The URL that specifies the behavior of this scalar.",
            None,
        )],
        is_repeatable: false,
        ast_node: None,
    });

/// Used to indicate an Input Object is a OneOf Input Object.
pub static GRAPHQL_ONE_OF_DIRECTIVE: LazyLock<GraphQLDirective<'static>> =
    LazyLock::new(|| GraphQLDirective {
        name: "oneOf",
        description: Some(
            "Indicates exactly one field must be supplied and this field must not be `null`.",
        ),
        locations: vec![directive_location::INPUT_OBJECT],
        args: Vec::new(),
        is_repeatable: false,
        ast_node: None,
    });

/// The full list of specified directives.
pub fn specified_directives() -> [&'static GraphQLDirective<'static>; 5] {
    [
        &GRAPHQL_INCLUDE_DIRECTIVE,
        &GRAPHQL_SKIP_DIRECTIVE,
        &GRAPHQL_DEPRECATED_DIRECTIVE,
        &GRAPHQL_SPECIFIED_BY_DIRECTIVE,
        &GRAPHQL_ONE_OF_DIRECTIVE,
    ]
}

pub fn is_specified_directive(directive: &GraphQLDirective) -> bool {
    specified_directives()
        .iter()
        .any(|specified| specified.name == directive.name)
}
