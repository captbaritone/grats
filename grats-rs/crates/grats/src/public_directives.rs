//! Grats supports some additional, non-spec server directives in order to
//! support experimental GraphQL features. This module contains the definition(s)
//! of those directives.

use graphql_js::language::ast::{
    ConstDirectiveNode, DefinitionNode, DirectiveDefinitionNode, Location, NameNode, UNTRACKED_ID,
};
use graphql_js::language::parser::{Parser, parse_only};
use graphql_js::language::source::Source;

pub const SEMANTIC_NON_NULL_DIRECTIVE: &str = "semanticNonNull";

// Matches https://gaps.graphql.org/GAP-49/draft/
const SEMANTIC_NON_NULL_SDL: &str = r#"
"""
Indicates that a field's result is semantically non null at the indicated levels:
it is only null if there is a matching error in the `errors` array of the response.
In all other cases, the position contains a value.

Tools doing code generation may use this information to generate the position as non-null if field errors are handled out of band:

```graphql
type User {
    # email is semantically non-null and can be generated as non-null by error-handling clients.
    email: String @semanticNonNull
}
```

The `levels` argument selects which levels of a (possibly nested) list type are semantically non null:

```graphql
type User {
    # friends is semantically non null
    friends: [User] @semanticNonNull # same as @semanticNonNull(levels: [0])

    # every friends[k] is semantically non null
    friends: [User] @semanticNonNull(levels: [1])

    # friends as well as every friends[k] is semantically non null
    friends: [User] @semanticNonNull(levels: [0, 1])
}
```

`levels` are zero indexed, where level 0 is the field's own value.
A level that is negative, or that exceeds the list dimensionality of the annotated field, is an error.
Applying `@semanticNonNull` to a level that is already Non-Null is an error.
"""
directive @semanticNonNull(levels: [Int!]! = [0]) on FIELD_DEFINITION
"#;

/// The definition of `@semanticNonNull`. It's parsed without locations, so
/// errors about it are reported at the user's code (see
/// `graphql_error_to_diagnostic`).
fn semantic_non_null_directive_definition() -> DirectiveDefinitionNode {
    let source = Source::without_locations(SEMANTIC_NON_NULL_SDL);
    parse_only(source, Parser::parse_directive_definition).expect("Grats' directives should parse")
}

pub fn add_semantic_non_null_directive(definitions: Vec<DefinitionNode>) -> Vec<DefinitionNode> {
    let directive = DefinitionNode::DirectiveDefinition(semantic_non_null_directive_definition());
    std::iter::once(directive).chain(definitions).collect()
}

pub fn make_semantic_non_null_directive(loc: Location) -> ConstDirectiveNode {
    ConstDirectiveNode {
        loc: Some(loc),
        name: NameNode {
            loc: Some(loc),
            value: SEMANTIC_NON_NULL_DIRECTIVE.to_string(),
            ts_identifier: UNTRACKED_ID,
        },
        arguments: None,
    }
}
