use graphql_js::error::graphql_error::GraphQLError;
use graphql_js::language::ast::Location;
use oxc_span::Span;
use serde::{Deserialize, Serialize};

use crate::files::ParsedFile;
use crate::jsdoc::CommentRange;

/// An error to report to the user. Its location, if it has one, refers to a
/// `SourceTable`. See `crate::utils::format_diagnostics` for how it's printed.
#[derive(Debug, Clone)]
pub struct Diagnostic {
    pub message_text: String,
    pub loc: Option<Location>,
    pub related_information: Option<Vec<DiagnosticRelatedInformation>>,
    pub fix: Option<Box<CodeFixAction>>,
}

/// A location related to a `Diagnostic`, with a message explaining how.
#[derive(Debug, Clone)]
pub struct DiagnosticRelatedInformation {
    pub message_text: String,
    pub loc: Location,
}

/// A fix for a `Diagnostic`, which `--fix` can apply. Its offsets are
/// UTF-16.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeFixAction {
    pub fix_name: String,
    pub description: String,
    pub changes: Vec<FileTextChanges>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTextChanges {
    pub file_name: String,
    pub text_changes: Vec<TextChange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextChange {
    pub span: TextSpan,
    pub new_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextSpan {
    pub start: u32,
    pub length: u32,
}

pub type DiagnosticResult<T> = Result<T, Diagnostic>;

pub type DiagnosticsResult<T> = Result<T, Vec<Diagnostic>>;

/// The error is at the location of the first of its nodes which has one, and
/// the rest are related locations, so errors about Grats' own directives
/// (which have no locations) are reported at the user's code. An error whose
/// nodes have no locations has none.
pub fn graphql_error_to_diagnostic(error: &GraphQLError) -> Diagnostic {
    let mut locs = error.nodes.iter().flatten();
    let loc = locs.next().copied();
    let related: Vec<_> = locs
        .map(|loc| gql_related(Some(*loc), "Related location"))
        .collect();
    Diagnostic {
        message_text: error.message.clone(),
        loc,
        related_information: (!related.is_empty()).then_some(related),
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

/// An error at a GraphQL AST node's location, which must be set.
pub fn gql_err(
    loc: Option<Location>,
    message: String,
    related_information: Option<Vec<DiagnosticRelatedInformation>>,
) -> Diagnostic {
    Diagnostic {
        message_text: message,
        loc: Some(loc.expect("Expected item to have loc")),
        related_information,
        fix: None,
    }
}

/// A related location at a GraphQL AST node's location, which must be set.
pub fn gql_related(loc: Option<Location>, message: &str) -> DiagnosticRelatedInformation {
    DiagnosticRelatedInformation {
        message_text: message.to_string(),
        loc: loc.expect("Expected item to have loc"),
    }
}

/// An error at a range of a comment in `file`. The range's offsets are UTF-8.
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

/// The location of a TypeScript AST node, as needed to report diagnostics: its
/// file and its UTF-16 offsets.
#[derive(Debug, Clone, Copy)]
pub struct TsLocatableNode<'f> {
    pub source: u32,
    pub file_name: &'f str,
    pub start: u32,
    pub end: u32,
}

impl<'f> TsLocatableNode<'f> {
    /// The span is oxc's, which excludes leading trivia.
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

pub fn ts_related(node: TsLocatableNode, message: String) -> DiagnosticRelatedInformation {
    DiagnosticRelatedInformation {
        message_text: message,
        loc: node.loc(),
    }
}
