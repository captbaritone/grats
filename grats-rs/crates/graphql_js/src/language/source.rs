//! Port of graphql-js `language/source.ts`.

/// A representation of source input to GraphQL. The `name` and `locationOffset` parameters are
/// optional, but they are useful for clients who store GraphQL documents in source files.
/// For example, if the GraphQL input starts at line 40 in a file named `Foo.graphql`, it might
/// be useful for `name` to be `"Foo.graphql"` and location to be `{ line: 40, column: 1 }`.
/// The `line` and `column` properties in `locationOffset` are 1-indexed.
///
/// PORT: Locations reference their source by `id`, its index in a
/// `SourceTable` (see `Location`), which also holds its name, so a source
/// must be added to the table before it's parsed. Like graphql-js's
/// `noLocation` option, nothing parsed from a source without an `id` has a
/// location, nor do its syntax errors. `body` may be a range of
/// that source: `offset` is where it starts, in UTF-16 code units, which is
/// added to the locations of what's parsed. If `docblock` is set, `body` is
/// the text of a JSDoc tag, and the leading `*` of each of its lines after
/// the first is ignored.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Source<'s> {
    pub body: &'s str,
    pub id: Option<u32>,
    pub offset: u32,
    pub docblock: bool,
}

impl<'s> Source<'s> {
    pub fn new(body: &'s str, id: u32) -> Self {
        Source {
            body,
            id: Some(id),
            offset: 0,
            docblock: false,
        }
    }

    /// PORT: A source which isn't in a `SourceTable`, like graphql-js's
    /// `noLocation` option.
    pub fn without_locations(body: &'s str) -> Self {
        Source {
            body,
            id: None,
            offset: 0,
            docblock: false,
        }
    }

    /// PORT: The text of a JSDoc tag, which starts at `offset` in the source
    /// `id`.
    pub fn docblock(body: &'s str, id: u32, offset: u32) -> Self {
        Source {
            body,
            id: Some(id),
            offset,
            docblock: true,
        }
    }
}
