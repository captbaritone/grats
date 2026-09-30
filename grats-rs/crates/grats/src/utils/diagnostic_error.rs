//! Port of `src/utils/DiagnosticError.ts`.
//!
//! PORT: Only the helpers used by ported code.

use graphql_js::error::graphql_error::GraphQLError;
use graphql_js::language::ast::Location;
use oxc_span::Span;
use serde::Serialize;

use crate::files::ParsedFile;
use crate::jsdoc::CommentRange;

/// PORT: A `ts.Diagnostic` in the TypeScript implementation. Diagnostics
/// carry GraphQL locations (or none, for `locationless_err`), which refer to
/// a `SourceTable`, and they're formatted before they cross to the TypeScript
/// side (see `crate::utils::format_diagnostics`).
#[derive(Debug, Clone)]
pub struct Diagnostic {
    pub message_text: String,
    pub loc: Option<Location>,
    pub related_information: Option<Vec<DiagnosticRelatedInformation>>,
    pub fix: Option<Box<CodeFixAction>>,
}

/// PORT: A `ts.DiagnosticRelatedInformation`. See `Diagnostic`.
#[derive(Debug, Clone)]
pub struct DiagnosticRelatedInformation {
    pub message_text: String,
    pub loc: Location,
}

/// PORT: A `ts.CodeFixAction`, the `fix` of a `FixableDiagnostic`. Offsets
/// are UTF-16.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeFixAction {
    pub fix_name: String,
    pub description: String,
    pub changes: Vec<FileTextChanges>,
}

/// PORT: A `ts.FileTextChanges`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTextChanges {
    pub file_name: String,
    pub text_changes: Vec<TextChange>,
}

/// PORT: A `ts.TextChange`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TextChange {
    pub span: TextSpan,
    pub new_text: String,
}

/// PORT: A `ts.TextSpan`.
#[derive(Debug, Clone, Serialize)]
pub struct TextSpan {
    pub start: u32,
    pub length: u32,
}

pub type DiagnosticResult<T> = Result<T, Diagnostic>;

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
        fix: None,
    }
}

pub fn locationless_err(message: String) -> Diagnostic {
    Diagnostic {
        message_text: message,
        loc: None,
        related_information: None,
        fix: None,
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
        fix: None,
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

/// PORT: `rangeErr`. Takes the file whose comment the range is in, rather
/// than its `ts.SourceFile`. The range's offsets are UTF-8.
pub fn range_err(
    file: &ParsedFile,
    comment_range: &CommentRange,
    message: String,
    related_information: Option<Vec<DiagnosticRelatedInformation>>,
    fix: Option<CodeFixAction>,
) -> Diagnostic {
    let start = file.offsets.to_utf16(comment_range.pos);
    let end = file.offsets.to_utf16(comment_range.end);
    Diagnostic {
        message_text: message,
        loc: Some(Location {
            source: file.source,
            start,
            end,
        }),
        related_information,
        fix: fix.map(Box::new),
    }
}

/// A generic version of the methods on ts.Node that we need
/// to create diagnostics.
///
/// PORT: A node's file and UTF-16 offsets, rather than an interface
/// implemented by `ts.Node`s and Grats' own classes.
#[derive(Debug, Clone, Copy)]
pub struct TsLocatableNode<'f> {
    pub source: u32,
    pub file_name: &'f str,
    pub start: u32,
    pub end: u32,
}

impl<'f> TsLocatableNode<'f> {
    /// PORT: `start` is `getStart()`, which excludes leading trivia, so the
    /// span is oxc's.
    pub fn new(file: &'f ParsedFile, span: Span) -> Self {
        TsLocatableNode {
            source: file.source,
            file_name: &file.path,
            start: file.offsets.to_utf16(span.start),
            end: file.offsets.to_utf16(span.end),
        }
    }

    pub fn loc(&self) -> Location {
        Location {
            source: self.source,
            start: self.start,
            end: self.end,
        }
    }
}

pub fn ts_err(
    node: TsLocatableNode,
    message: String,
    related_information: Option<Vec<DiagnosticRelatedInformation>>,
    fix: Option<CodeFixAction>,
) -> Diagnostic {
    Diagnostic {
        message_text: message,
        loc: Some(node.loc()),
        related_information,
        fix: fix.map(Box::new),
    }
}

/// PORT: TypeScript gives related information made from nodes the code 0,
/// rather than `FAKE_ERROR_CODE`, which isn't printed.
pub fn ts_related(node: TsLocatableNode, message: String) -> DiagnosticRelatedInformation {
    DiagnosticRelatedInformation {
        message_text: message,
        loc: node.loc(),
    }
}
