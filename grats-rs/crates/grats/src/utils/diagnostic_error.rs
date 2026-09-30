//! Port of `src/utils/DiagnosticError.ts`.
//!
//! PORT: Only the helpers used by ported code.

use graphql_js::error::graphql_error::GraphQLError;
use graphql_js::language::ast::Location;
use serde::Serialize;

/// PORT: A `ts.Diagnostic` in the TypeScript implementation. Rust has no
/// source files to reference, so diagnostics carry GraphQL locations (or none,
/// for `locationless_err`), and the TypeScript side builds the
/// `ts.Diagnostic`. See `decodeDiagnostic` in `src/rs/codec.ts`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub message_text: String,
    pub loc: Option<Location>,
    pub related_information: Option<Vec<DiagnosticRelatedInformation>>,
}

/// PORT: A `ts.DiagnosticRelatedInformation`. See `Diagnostic`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticRelatedInformation {
    pub message_text: String,
    pub loc: Location,
}

pub type DiagnosticsWithoutLocationResult<T> = Result<T, Vec<Diagnostic>>;

/// PORT: Diagnostics made by `gql_err` always have a location, but share a
/// type with those which may not.
pub type DiagnosticsResult<T> = Result<T, Vec<Diagnostic>>;

/// PORT: graphql-js derives the error's `positions` and `source` from its
/// nodes' locations, so its first position and its source are those of the
/// first node which has a location.
pub fn graphql_error_to_diagnostic(error: &GraphQLError) -> Diagnostic {
    let Some(position) = error.nodes.iter().flatten().next() else {
        panic!("Expected error to have a position");
    };

    // Start with baseline location information
    let mut loc = Location {
        source: position.source,
        start: position.start,
        end: position.start + 1,
    };
    let mut related_information = None;

    // Nodes have actual ranges (not just a single position), so we we have one
    // (or more!) use that instead.
    if let Some((node, rest)) = error.nodes.split_first()
        && let Some(node_loc) = node
    {
        loc = *node_loc;
        if !rest.is_empty() {
            let mut related = Vec::new();
            for related_node in rest {
                if related_node.is_none() {
                    continue;
                }
                related.push(gql_related(*related_node, "Related location"));
            }
            related_information = Some(related);
        }
    }

    Diagnostic {
        message_text: error.message.clone(),
        loc: Some(loc),
        related_information,
    }
}

pub fn locationless_err(message: String) -> Diagnostic {
    Diagnostic {
        message_text: message,
        loc: None,
        related_information: None,
    }
}

/// PORT: Takes the item's location, rather than an item with a `loc`.
pub fn gql_err(
    loc: Option<Location>,
    message: String,
    related_information: Option<Vec<DiagnosticRelatedInformation>>,
) -> Diagnostic {
    let Some(loc) = loc else {
        panic!("Expected item to have loc");
    };
    Diagnostic {
        message_text: message,
        loc: Some(loc),
        related_information,
    }
}

/// PORT: Takes the item's location, rather than an item with a `loc`.
pub fn gql_related(loc: Option<Location>, message: &str) -> DiagnosticRelatedInformation {
    let Some(loc) = loc else {
        panic!("Expected item to have loc");
    };
    DiagnosticRelatedInformation {
        message_text: message.to_string(),
        loc,
    }
}
