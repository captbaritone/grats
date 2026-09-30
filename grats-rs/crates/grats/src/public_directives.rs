//! Port of `src/publicDirectives.ts`.
//!
//! Grats supports some additional, non-spec server directives in order to
//! support experimental GraphQL features. This module contains the definition(s)
//! of those directives.
//!
//! PORT: Only the parts used by ported code are ported so far.

use graphql_js::language::ast::{
    ConstDirectiveNode, DefinitionNode, DocumentNode, Location, NameNode,
};
use graphql_js::language::parser::parse;
use graphql_js::language::source::{DEFAULT_SOURCE_NAME, Source};

use crate::source_table::SourceTable;
use crate::utils::helpers::UNTRACKED_ID;

pub const SEMANTIC_NON_NULL_DIRECTIVE: &str = "semanticNonNull";

// Copied from https://github.com/apollographql/specs/blob/2a22ccf054994392a1b14d8810787cb27baee040/nullability/v0.2/nullability-v0.2.graphql#L1C1-L33C68
//
// PORT: The text which TypeScript parses into `DIRECTIVES_AST`.
const DIRECTIVES_SDL: &str = r#"
"""
Indicates that a position is semantically non null: it is only null if there is a matching error in the `errors` array.
In all other cases, the position is non-null.

Tools doing code generation may use this information to generate the position as non-null if field errors are handled out of band:

```graphql
type User {
    # email is semantically non-null and can be generated as non-null by error-handling clients.
    email: String @semanticNonNull
}
```

The `levels` argument indicates what levels are semantically non null in case of lists:

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

`levels` are zero indexed.
Passing a negative level or a level greater than the list dimension is an error.
"""
directive @semanticNonNull(levels: [Int] = [0]) on FIELD_DEFINITION
"#;

/// PORT: `DIRECTIVES_AST`, which TypeScript parses when the module loads. Its
/// source is added to the `SourceTable` so that locations can refer to it.
pub fn directives_ast(sources: &SourceTable) -> DocumentNode {
    let source = Source::new(
        DIRECTIVES_SDL.to_string(),
        DEFAULT_SOURCE_NAME.to_string(),
        sources.add(DEFAULT_SOURCE_NAME, DIRECTIVES_SDL),
    );
    parse(&source).expect("Grats' directives should parse")
}

/// PORT: `DIRECTIVES_AST` is parsed on demand (see `directives_ast`).
pub fn add_semantic_non_null_directive(
    sources: &SourceTable,
    definitions: Vec<DefinitionNode>,
) -> Vec<DefinitionNode> {
    directives_ast(sources)
        .definitions
        .into_iter()
        .chain(definitions)
        .collect()
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
