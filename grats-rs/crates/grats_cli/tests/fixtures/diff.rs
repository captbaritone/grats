//! PORT: jest-diff's `diff` of two strings, as the TypeScript harness called
//! it to show a fix's changes: with annotations, without colors, and with
//! one line of context around each change (`expand: false`).

use similar::{Algorithm, ChangeTag, capture_diff_slices};

const CONTEXT_LINES: usize = 1;

pub fn diff(a: &str, b: &str, a_annotation: &str, b_annotation: &str) -> String {
    if a == b {
        return "Compared values have no visual difference.".to_string();
    }
    let a_lines = lines(a);
    let b_lines = lines(b);
    let mut diffs = Vec::new();
    for op in capture_diff_slices(Algorithm::Myers, &a_lines, &b_lines) {
        for change in op.iter_changes(&a_lines, &b_lines) {
            diffs.push((change.tag(), change.value()));
        }
    }
    format!(
        "- {a_annotation}\n+ {b_annotation}\n\n{}",
        join_aligned_diffs_no_expand(&diffs)
    )
}

/// An empty string has no lines.
fn lines(text: &str) -> Vec<&str> {
    if text.is_empty() {
        Vec::new()
    } else {
        text.split('\n').collect()
    }
}

fn print_diff_line(line: &str, indicator: char) -> String {
    if line.is_empty() {
        if indicator == ' ' {
            String::new()
        } else {
            indicator.to_string()
        }
    } else {
        format!("{indicator} {line}")
    }
}

/// PORT: `joinAlignedDiffsNoExpand`: the lines with patch marks, if any
/// common lines are omitted.
fn join_aligned_diffs_no_expand(diffs: &[(ChangeTag, &str)]) -> String {
    let i_length = diffs.len();
    let n_context_lines2 = CONTEXT_LINES * 2;
    let is_equal = |i: usize| diffs[i].0 == ChangeTag::Equal;

    // First pass: see if it has patches.
    let mut has_excess_at_start_or_end = false;
    let mut n_excesses_between_changes = 0;
    let mut i = 0;
    while i != i_length {
        let i_start = i;
        while i != i_length && is_equal(i) {
            i += 1;
        }
        if i_start != i {
            let n = i - i_start;
            if i_start == 0 || i == i_length {
                if n > CONTEXT_LINES {
                    has_excess_at_start_or_end = true;
                }
            } else if n > n_context_lines2 {
                n_excesses_between_changes += 1;
            }
        }
        while i != i_length && !is_equal(i) {
            i += 1;
        }
    }
    let has_patch = n_excesses_between_changes != 0 || has_excess_at_start_or_end;

    let mut out = Output::default();
    if has_patch {
        out.lines.push(String::new());
    }

    // Second pass: push lines with diff formatting (and patch marks).
    let mut i = 0;
    while i != i_length {
        let mut i_start = i;
        while i != i_length && is_equal(i) {
            i += 1;
        }
        if i_start != i {
            if i_start == 0 {
                // At the beginning.
                if i > CONTEXT_LINES {
                    i_start = i - CONTEXT_LINES;
                    out.start_patch(i_start, i_start);
                }
                out.push_common(&diffs[i_start..i]);
            } else if i == i_length {
                // At the end.
                let i_end = if i - i_start > CONTEXT_LINES {
                    i_start + CONTEXT_LINES
                } else {
                    i
                };
                out.push_common(&diffs[i_start..i_end]);
            } else {
                // Between changes.
                let n_common = i - i_start;
                if n_common > n_context_lines2 {
                    out.push_common(&diffs[i_start..i_start + CONTEXT_LINES]);
                    out.mark_patch();
                    out.j_patch_mark = out.lines.len();
                    out.lines.push(String::new());
                    let n_omit = n_common - n_context_lines2;
                    out.start_patch(out.a_end + n_omit, out.b_end + n_omit);
                    out.push_common(&diffs[i - CONTEXT_LINES..i]);
                } else {
                    out.push_common(&diffs[i_start..i]);
                }
            }
        }
        while i != i_length && diffs[i].0 == ChangeTag::Delete {
            out.lines.push(print_diff_line(diffs[i].1, '-'));
            out.a_end += 1;
            i += 1;
        }
        while i != i_length && diffs[i].0 == ChangeTag::Insert {
            out.lines.push(print_diff_line(diffs[i].1, '+'));
            out.b_end += 1;
            i += 1;
        }
    }
    if has_patch {
        out.mark_patch();
    }
    out.lines.join("\n")
}

/// The lines so far, and the indexes of the lines of `a` and `b` in the
/// current patch.
#[derive(Default)]
struct Output {
    lines: Vec<String>,
    /// The index of the placeholder line for the current patch mark.
    j_patch_mark: usize,
    a_start: usize,
    b_start: usize,
    a_end: usize,
    b_end: usize,
}

impl Output {
    fn start_patch(&mut self, a_start: usize, b_start: usize) {
        self.a_start = a_start;
        self.b_start = b_start;
        self.a_end = a_start;
        self.b_end = b_start;
    }

    fn push_common(&mut self, diffs: &[(ChangeTag, &str)]) {
        for (_, line) in diffs {
            self.lines.push(print_diff_line(line, ' '));
            self.a_end += 1;
            self.b_end += 1;
        }
    }

    /// In GNU diff format, indexes are one-based instead of zero-based.
    fn mark_patch(&mut self) {
        self.lines[self.j_patch_mark] = format!(
            "@@ -{},{} +{},{} @@",
            self.a_start + 1,
            self.a_end - self.a_start,
            self.b_start + 1,
            self.b_end - self.b_start
        );
    }
}
