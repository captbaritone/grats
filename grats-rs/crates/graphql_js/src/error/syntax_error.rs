//! Port of graphql-js `error/syntaxError.ts`.

use super::graphql_error::GraphQLError;
use crate::language::source::Source;

/// Produces a GraphQLError representing a syntax error, containing useful
/// descriptive information about the syntax error's position in the source.
///
/// PORT: `GraphQLError` doesn't model a source and positions, since Grats only
/// reads the message of syntax errors.
pub fn syntax_error(_source: &Source<'_>, _position: usize, description: &str) -> GraphQLError {
    GraphQLError::new(format!("Syntax Error: {description}"), Vec::new())
}
