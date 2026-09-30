//! Port of `src/utils/DiagnosticError.ts`.
//!
//! PORT: Only the helpers used by ported code.

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
