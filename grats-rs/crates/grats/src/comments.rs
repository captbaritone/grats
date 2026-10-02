//! Reports Grats tags in comments where they have no effect.
//!
//! Offsets are UTF-8, and are converted when diagnostics are made.

use std::collections::HashSet;

use crate::code_actions as act;
use crate::errors as e;
use crate::extractor::{KILLS_PARENT_ON_EXCEPTION_TAG, TAGS};
use crate::files::ParsedFile;
use crate::jsdoc::{CommentKind, CommentRange, is_js_white_space};
use crate::utils::diagnostic_error::{CodeFixAction, Diagnostic, range_err};

/// Matches a line that starts with optional `*`s followed by `@gql...` or
/// `@killsParentOnException`, ignoring case. Returns the lengths of the prefix
/// and the tag.
fn match_tag_line(line: &str) -> Option<(usize, usize)> {
    // Whitespace and asterisks are distinct, so matching greedily never needs
    // to backtrack.
    let after_space = line.trim_start_matches(is_js_white_space);
    let after_stars = after_space.trim_start_matches('*');
    let rest = after_stars.trim_start_matches(is_js_white_space);
    let prefix = line.len() - rest.len();
    let name = rest.strip_prefix('@')?;
    let name_len = if name.get(..3).is_some_and(|s| s.eq_ignore_ascii_case("gql")) {
        3 + name[3..]
            .find(|c: char| !c.is_ascii_alphabetic())
            .unwrap_or(name.len() - 3)
    } else if name
        .get(..KILLS_PARENT_ON_EXCEPTION_TAG.len())
        .is_some_and(|s| s.eq_ignore_ascii_case(KILLS_PARENT_ON_EXCEPTION_TAG))
    {
        KILLS_PARENT_ON_EXCEPTION_TAG.len()
    } else {
        return None;
    };
    Some((prefix, 1 + name_len))
}

// Report helpful errors when tags are used in invalid positions
// such as non JSDoc block comments or line comments.
pub fn detect_invalid_comments(
    source_file: &ParsedFile,
    valid_comment_positions: &HashSet<u32>,
) -> Vec<Diagnostic> {
    let mut errors = Vec::new();
    // oxc collects the file's comments, in order, while parsing.
    for comment in source_file.semantic().comments() {
        if valid_comment_positions.contains(&comment.span.start) {
            continue;
        }
        let is_line = comment.is_line();
        let comment = CommentRange {
            pos: comment.span.start,
            end: comment.span.end,
            kind: if is_line {
                CommentKind::SingleLineCommentTrivia
            } else {
                CommentKind::MultiLineCommentTrivia
            },
        };

        let start = comment.pos + 2; // Skip the // or /*
        let end = comment.end - if is_line { 0 } else { 2 }; // Maybe skip the */ at the end

        let text_slice = &source_file.text[start as usize..end as usize];
        for (tag_name, range) in get_grats_adjacent_tags(text_slice, start, comment.kind) {
            if !TAGS.contains(&tag_name) {
                errors.push(range_err(
                    source_file,
                    &range,
                    e::invalid_grats_tag(tag_name),
                    None,
                    None,
                ));
            }
            if is_line {
                errors.push(range_err(
                    source_file,
                    &range,
                    e::gql_tag_in_line_comment(),
                    Some(vec![]),
                    Some(CodeFixAction {
                        fix_name: "convert-line-comment-to-docblock-comment".to_string(),
                        description: "Convert to a docblock comment".to_string(),
                        changes: vec![act::convert_line_comment_to_docblock(source_file, &comment)],
                    }),
                ));
            } else if !text_slice.starts_with('*') {
                errors.push(range_err(
                    source_file,
                    &range,
                    e::gql_tag_in_non_jsdoc_block_comment(),
                    Some(vec![]),
                    Some(CodeFixAction {
                        fix_name: "convert-block-comment-to-docblock-comment".to_string(),
                        description: "Convert to a docblock comment".to_string(),
                        changes: vec![act::convert_block_comment_to_docblock(
                            source_file,
                            &comment,
                        )],
                    }),
                ));
            } else {
                errors.push(range_err(
                    source_file,
                    &range,
                    e::gql_tag_in_detached_jsdoc_block_comment(),
                    None,
                    None,
                ));
            }
        }
    }
    errors
}

// Extract @gql or @killsParentOnException tags from the text of a comment,
// which starts at `text_pos`, along with their positions.
fn get_grats_adjacent_tags(
    text: &str,
    text_pos: u32,
    kind: CommentKind,
) -> Vec<(&str, CommentRange)> {
    let mut tags = Vec::new();
    let mut line_pos = text_pos;
    for line in text.split('\n') {
        if let Some((prefix_len, tag_len)) = match_tag_line(line) {
            let pos = line_pos + prefix_len as u32;
            let range = CommentRange {
                kind,
                pos,
                end: pos + tag_len as u32,
            };
            let tag_name = &line[prefix_len + 1..prefix_len + tag_len]; // Trim the @
            tags.push((tag_name, range));
        }
        line_pos += line.len() as u32 + 1;
    }
    tags
}
