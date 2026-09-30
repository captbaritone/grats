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

use crate::utils::helpers::UNTRACKED_ID;

pub const SEMANTIC_NON_NULL_DIRECTIVE: &str = "semanticNonNull";

/// PORT: `DIRECTIVES_AST` is parsed from GraphQL text on the TypeScript side,
/// which passes it in with the document (see `PipelineRequest`) until Rust can
/// parse GraphQL.
pub fn add_semantic_non_null_directive(
    directives_ast: DocumentNode,
    definitions: Vec<DefinitionNode>,
) -> Vec<DefinitionNode> {
    directives_ast
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
