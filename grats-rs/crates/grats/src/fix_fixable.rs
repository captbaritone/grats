//! Applies the code fixes of diagnostics to the files they edit.
//!
//! Text changes have UTF-16 offsets, so they're applied to the text as UTF-16.

use indexmap::IndexMap;

use crate::host::Host;
use crate::utils::diagnostic_error::{CodeFixAction, DiagnosticsResult, TextChange};
use crate::utils::path;

pub struct FixOptions<'o> {
    pub fix: bool,
    pub log: &'o dyn Fn(&str),
}

/// Apply fixes repeatedly until all fixable diagnostics are resolved or no more fixes can be applied.
/// Returns ok if all errors were fixed, err if some unfixable errors remain.
/// If options.fix is false, just runs the function once without any fixing.
pub fn with_fixes_fixed<T>(
    result_fn: impl Fn() -> DiagnosticsResult<T>,
    options: &FixOptions,
    host: &dyn Host,
    grats_root: &str,
) -> DiagnosticsResult<T> {
    const MAX_ITERATIONS: usize = 10;
    if !options.fix {
        return result_fn();
    }

    let mut total_fixes_applied = 0;

    for iteration in 0..=MAX_ITERATIONS {
        if iteration > 0 {
            (options.log)(&format!(
                "\nGrats: Re-running with fixes applied (iteration {iteration})...\n"
            ));
        }
        let diagnostics = match result_fn() {
            Ok(value) => {
                if total_fixes_applied > 0 && iteration > 2 {
                    let fixes = if total_fixes_applied == 1 {
                        "fix"
                    } else {
                        "fixes total"
                    };
                    (options.log)(&format!("Grats: Applied {total_fixes_applied} {fixes}."));
                }
                return Ok(value);
            }
            Err(diagnostics) => diagnostics,
        };

        // Extract fixable diagnostics
        let fixable_diagnostics: Vec<&CodeFixAction> = diagnostics
            .iter()
            .filter_map(|diagnostic| diagnostic.fix.as_deref())
            .collect();

        if fixable_diagnostics.is_empty() {
            // No fixable diagnostics, return the error result
            return Err(diagnostics);
        }

        let issues = if fixable_diagnostics.len() == 1 {
            "issue"
        } else {
            "issues"
        };
        (options.log)(&format!(
            "Grats: Identified {} fixable {issues}:",
            fixable_diagnostics.len()
        ));

        // Apply fixes
        apply_fixes(&fixable_diagnostics, options, host, grats_root);
        total_fixes_applied += fixable_diagnostics.len();
    }

    // If we reach here, we've hit max iterations - return the last result
    (options.log)(&format!(
        "Grats: Reached maximum iterations ({MAX_ITERATIONS}). Some issues may remain."
    ));
    result_fn()
}

/// Applies fixes to the files they edit, and logs each applied fix.
///
/// Returns true if any files were changed, false otherwise.
pub fn apply_fixes(
    fixes: &[&CodeFixAction],
    options: &FixOptions,
    host: &dyn Host,
    grats_root: &str,
) -> bool {
    let mut applied_any_fixes = false;

    // Group text changes by file to batch changes
    let mut changes_by_file: IndexMap<&str, Vec<&TextChange>> = IndexMap::new();
    for change in fixes.iter().flat_map(|fix| &fix.changes) {
        changes_by_file
            .entry(&change.file_name)
            .or_default()
            .extend(&change.text_changes);
    }

    for (file_name, mut text_changes) in changes_by_file {
        let failed = |error: &str| {
            (options.log)(&format!(
                "Grats: Failed to apply fix to {}: {error}",
                path::to_native(file_name)
            ));
        };
        let Some(content) = host.read_file(file_name) else {
            failed("Could not read the file.");
            continue;
        };
        let mut new_content: Vec<u16> = content.encode_utf16().collect();

        // Apply changes in reverse order to avoid offset issues
        text_changes.sort_by_key(|change| std::cmp::Reverse(change.span.start));
        for change in text_changes {
            let start = (change.span.start as usize).min(new_content.len());
            let end = (start + change.span.length as usize).min(new_content.len());
            new_content.splice(start..end, change.new_text.encode_utf16());
        }

        match host.write_file(file_name, &String::from_utf16_lossy(&new_content)) {
            Ok(()) => applied_any_fixes = true,
            Err(error) => failed(&error),
        }
    }

    // Report all fixes at the end
    for fix in fixes {
        if let Some(change) = fix.changes.first() {
            (options.log)(&format!(
                "  * Applied fix \"{}\" in {}",
                fix.description,
                path::relative(grats_root, &change.file_name)
            ));
        }
    }

    applied_any_fixes
}
