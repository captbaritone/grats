//! Port of graphql-js `language/source.ts`.

/// A representation of source input to GraphQL. The `name` and `locationOffset` parameters are
/// optional, but they are useful for clients who store GraphQL documents in source files.
/// For example, if the GraphQL input starts at line 40 in a file named `Foo.graphql`, it might
/// be useful for `name` to be `"Foo.graphql"` and location to be `{ line: 40, column: 1 }`.
/// The `line` and `column` properties in `locationOffset` are 1-indexed.
///
/// PORT: Grats never passes a `locationOffset`. Locations reference their
/// source by `id`, its index in a `SourceTable` (see
/// `Location`), so a source must be added to the table before it's parsed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Source {
    pub body: String,
    pub name: String,
    pub id: u32,
}

/// PORT: The default `name` of a `Source`.
pub const DEFAULT_SOURCE_NAME: &str = "GraphQL request";

impl Source {
    pub fn new(body: String, name: String, id: u32) -> Self {
        Source { body, name, id }
    }
}
