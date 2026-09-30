//! Port of `src/comments.ts`.
//!
//! PORT: Offsets are UTF-8, and are converted when diagnostics are made.

use std::collections::HashSet;

use crate::code_actions as act;
use crate::errors as e;
use crate::extractor::{ALL_GQL_TAGS, KILLS_PARENT_ON_EXCEPTION_TAG, ONE_OF_TAG};
use crate::files::ParsedFile;
use crate::jsdoc::{CommentKind, CommentRange};
use crate::utils::diagnostic_error::{CodeFixAction, Diagnostic, range_err};

// A line that starts with optional *s followed by @gql or @killsParentOnException
/// PORT: `BLOCK_COMMENT_REGEX`, `/^(\s*\**\s*)(@((gql[a-z]*)|(killsParentOnException)))/i`.
/// Returns the lengths of the prefix and the tag.
fn match_block_comment_regex(line: &str) -> Option<(usize, usize)> {
    // Whitespace and asterisks are distinct, so matching greedily never needs
    // to backtrack.
    let after_space = line.trim_start_matches(is_js_whitespace);
    let after_stars = after_space.trim_start_matches('*');
    let rest = after_stars.trim_start_matches(is_js_whitespace);
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

/// PORT: JavaScript's `\s`.
fn is_js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{000B}' | '\u{000C}' | '\r' | ' ' | '\u{00A0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

// Report helpful errors when tags are used in invalid positions
// such as non JSDoc block comments or line comments.
pub fn detect_invalid_comments(
    source_file: &ParsedFile,
    valid_comment_positions: &HashSet<u32>,
) -> Vec<Diagnostic> {
    let mut errors = Vec::new();
    for_each_comment(source_file, |full_text, comment| {
        if valid_comment_positions.contains(&comment.pos) {
            return;
        }

        let is_line = comment.kind == CommentKind::SingleLineCommentTrivia;

        let start = comment.pos + 2; // Skip the // or /*
        let end = comment.end - if is_line { 0 } else { 2 }; // Maybe skip the */ at the end

        let text_slice = &full_text[start as usize..end as usize];
        let tags = get_grats_adjacent_tags(text_slice, comment);
        if tags.is_empty() {
            return;
        }
        for (tag_name, range) in tags {
            if !is_grats_docblock_tag(tag_name) {
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
                        changes: vec![act::convert_line_comment_to_docblock(source_file, comment)],
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
                        changes: vec![act::convert_block_comment_to_docblock(source_file, comment)],
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
    });
    errors
}

// Extract @gql or @killsParentOnException tags from a JSDoc block comment.
// along with their positions.
fn get_grats_adjacent_tags<'t>(
    text: &'t str,
    comment_range: &CommentRange,
) -> Vec<(&'t str, CommentRange)> {
    let mut offset = 0;
    let lines = text.split('\n');

    let mut tags = Vec::new();
    for line in lines {
        let Some((prefix_len, tag_len)) = match_block_comment_regex(line) else {
            offset += line.len() as u32 + 1;
            continue;
        };
        let tag = &line[prefix_len..prefix_len + tag_len];
        let pos = comment_range.pos + 2 + offset + prefix_len as u32;
        let end = pos + tag.len() as u32;
        let range = CommentRange {
            kind: comment_range.kind,
            pos,
            end,
        };
        let tag_name = &tag[1..]; // Trim the @
        tags.push((tag_name, range));
    }
    tags
}

fn is_grats_docblock_tag(tag: &str) -> bool {
    ALL_GQL_TAGS.contains(&tag) || tag == KILLS_PARENT_ON_EXCEPTION_TAG || tag == ONE_OF_TAG
}

/// TypeScript does not provide a way to iterate over comments, so this function
/// provides a way to iterate over all comments in a source file.
///
/// PORT: TypeScript's version visits the leading and trailing comments of
/// each token. Every comment is in exactly one of those lists (trailing
/// comments are those before the first line break after a token), and
/// tokens are visited in order, so these are the file's comments in order,
/// which oxc collects while parsing.
pub fn for_each_comment(source_file: &ParsedFile, mut callback: impl FnMut(&str, &CommentRange)) {
    let full_text = source_file.text;
    for comment in source_file.semantic().comments() {
        let kind = if comment.is_line() {
            CommentKind::SingleLineCommentTrivia
        } else {
            CommentKind::MultiLineCommentTrivia
        };
        callback(
            full_text,
            &CommentRange {
                pos: comment.span.start,
                end: comment.span.end,
                kind,
            },
        );
    }
}
