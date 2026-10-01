//! Port of graphql-js `error/syntaxError.ts`.

use super::graphql_error::GraphQLError;
use crate::language::ast::Location;
use crate::language::source::Source;

/// Produces a GraphQLError representing a syntax error, containing useful
/// descriptive information about the syntax error's position in the source.
///
/// PORT: graphql-js gives the error its source and position. Here its node is
/// the location of what's invalid, from `start` to `end` in the source's
/// body, which is where Grats reports it. A source without an id gives no
/// location.
pub fn syntax_error(
    source: &Source<'_>,
    start: usize,
    end: usize,
    description: &str,
) -> GraphQLError {
    GraphQLError::new(
        format!("Syntax Error: {description}"),
        vec![source.id.map(|id| Location {
            source: id,
            start: source.offset + start as u32,
            end: source.offset + end as u32,
        })],
    )
}
