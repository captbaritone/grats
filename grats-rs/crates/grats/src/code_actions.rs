//! Text changes for the code fixes of diagnostics.

use crate::files::ParsedFile;
use crate::jsdoc::CommentRange;
use crate::utils::diagnostic_error::{FileTextChanges, TextChange, TextSpan, TsLocatableNode};

pub fn prefix_node(node: TsLocatableNode, prefix: &str) -> FileTextChanges {
    file_changes(node.file_name, vec![text_change(node.start, 0, prefix)])
}

pub fn suffix_node(node: TsLocatableNode, suffix: &str) -> FileTextChanges {
    file_changes(node.file_name, vec![text_change(node.end, 0, suffix)])
}

pub fn remove_node(node: TsLocatableNode) -> FileTextChanges {
    replace_node(node, "")
}

pub fn replace_node(node: TsLocatableNode, new_text: &str) -> FileTextChanges {
    let change = text_change(node.start, node.end - node.start, new_text);
    file_changes(node.file_name, vec![change])
}

pub fn convert_line_comment_to_docblock(
    source_file: &ParsedFile,
    comment: &CommentRange,
) -> FileTextChanges {
    let to_utf16 = |offset| source_file.offsets.to_utf16(offset);
    file_changes(
        &source_file.path,
        vec![
            text_change(to_utf16(comment.pos), 2, "/**"),
            text_change(to_utf16(comment.end), 0, " */"),
        ],
    )
}

pub fn convert_block_comment_to_docblock(
    source_file: &ParsedFile,
    comment: &CommentRange,
) -> FileTextChanges {
    let start = source_file.offsets.to_utf16(comment.pos);
    file_changes(&source_file.path, vec![text_change(start, 2, "/**")])
}

fn file_changes(file_name: &str, text_changes: Vec<TextChange>) -> FileTextChanges {
    FileTextChanges {
        file_name: file_name.to_string(),
        text_changes,
    }
}

/// Text changes have UTF-16 offsets.
fn text_change(start: u32, length: u32, new_text: &str) -> TextChange {
    TextChange {
        span: TextSpan { start, length },
        new_text: new_text.to_string(),
    }
}
