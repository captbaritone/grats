//! Port of `src/CodeActions.ts`.

use crate::files::ParsedFile;
use crate::jsdoc::CommentRange;
use crate::utils::diagnostic_error::{FileTextChanges, TextChange, TextSpan, TsLocatableNode};

pub fn prefix_node(node: TsLocatableNode, prefix: &str) -> FileTextChanges {
    let start = node.start;
    FileTextChanges {
        file_name: node.file_name.to_string(),
        text_changes: vec![TextChange {
            span: TextSpan { start, length: 0 },
            new_text: prefix.to_string(),
        }],
    }
}

pub fn suffix_node(node: TsLocatableNode, suffix: &str) -> FileTextChanges {
    let end = node.end;
    FileTextChanges {
        file_name: node.file_name.to_string(),
        text_changes: vec![TextChange {
            span: TextSpan {
                start: end,
                length: 0,
            },
            new_text: suffix.to_string(),
        }],
    }
}

pub fn remove_node(node: TsLocatableNode) -> FileTextChanges {
    let start = node.start;
    let length = node.end - start;
    FileTextChanges {
        file_name: node.file_name.to_string(),
        text_changes: vec![TextChange {
            span: TextSpan { start, length },
            new_text: String::new(),
        }],
    }
}

pub fn replace_node(node: TsLocatableNode, new_text: &str) -> FileTextChanges {
    let start = node.start;
    let length = node.end - start;
    FileTextChanges {
        file_name: node.file_name.to_string(),
        text_changes: vec![TextChange {
            span: TextSpan { start, length },
            new_text: new_text.to_string(),
        }],
    }
}

/// PORT: The comment's offsets are UTF-8.
pub fn convert_line_comment_to_docblock(
    source_file: &ParsedFile,
    comment: &CommentRange,
) -> FileTextChanges {
    FileTextChanges {
        file_name: source_file.path.clone(),
        text_changes: vec![
            TextChange {
                span: TextSpan {
                    start: source_file.offsets.to_utf16(comment.pos),
                    length: 2,
                },
                new_text: "/**".to_string(),
            },
            TextChange {
                span: TextSpan {
                    start: source_file.offsets.to_utf16(comment.end),
                    length: 0,
                },
                new_text: " */".to_string(),
            },
        ],
    }
}

/// PORT: The comment's offsets are UTF-8.
pub fn convert_block_comment_to_docblock(
    source_file: &ParsedFile,
    comment: &CommentRange,
) -> FileTextChanges {
    FileTextChanges {
        file_name: source_file.path.clone(),
        text_changes: vec![TextChange {
            span: TextSpan {
                start: source_file.offsets.to_utf16(comment.pos),
                length: 2,
            },
            new_text: "/**".to_string(),
        }],
    }
}
