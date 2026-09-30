//! Port of graphql-js `error/GraphQLError.ts`.

use crate::language::ast::Location;

/// A GraphQLError describes an Error found during the parse, validate, or
/// execute phases of performing a GraphQL operation. In addition to a message
/// and stack trace, it also includes information about the locations in a
/// GraphQL document and/or execution result that correspond to the Error.
///
/// PORT: Only the message and nodes are modeled.
#[derive(Debug, Clone, PartialEq)]
pub struct GraphQLError {
    pub message: String,
    /// An array of GraphQL AST Nodes corresponding to this error.
    ///
    /// PORT: The nodes' locations, which is all Grats reads of them.
    pub nodes: Vec<Option<Location>>,
}

impl GraphQLError {
    pub fn new(message: String, nodes: Vec<Option<Location>>) -> Self {
        GraphQLError { message, nodes }
    }
}
