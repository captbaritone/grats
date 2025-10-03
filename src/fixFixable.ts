import * as ts from "typescript";
import {
  DiagnosticsWithoutLocationResult,
  FixableDiagnostic,
} from "./utils/DiagnosticError";
import { writeFileSync, readFileSync } from "fs";
import { relativePath } from "./gratsRoot";

export type FixOptions = {
  fix: boolean;
  log: (msg: string) => void;
};

/**
 * Apply fixes repeatedly until all fixable diagnostics are resolved or no more fixes can be applied.
 * Returns ok if all errors were fixed, err if some unfixable errors remain.
 * If options.fix is false, just runs the function once without any fixing.
 */
export function withFixesFixed<T>(
  resultFn: () => DiagnosticsWithoutLocationResult<T>,
  options: FixOptions,
): DiagnosticsWithoutLocationResult<T> {
  if (!options.fix) {
    return resultFn();
  }

  let totalFixesApplied = 0;
  const maxIterations = 10;

  for (let iteration = 0; iteration <= maxIterations; iteration++) {
    if (iteration > 0) {
      options.log(
        `\nGrats: Re-running with fixes applied (iteration ${iteration})...\n`,
      );
    }
    const result = resultFn();

    if (result.kind === "OK") {
      if (totalFixesApplied > 0 && iteration > 2) {
        const fixes = totalFixesApplied === 1 ? "fix" : "fixes total";
        options.log(`Grats: Applied ${totalFixesApplied} ${fixes}.`);
      }
      return result;
    }

    // Extract fixable diagnostics
    const fixableDiagnostics = result.err.filter(
      (d) => "fix" in d && d.fix != null,
    );

    if (fixableDiagnostics.length === 0) {
      // No fixable diagnostics, return the error result
      return result;
    }

    const issues = fixableDiagnostics.length === 1 ? "issue" : "issues";
    options.log(
      `Grats: Identified ${fixableDiagnostics.length} fixable ${issues}:`,
    );

    // Apply fixes
    applyFixes(fixableDiagnostics, options);
    totalFixesApplied += fixableDiagnostics.length;
  }

  // If we reach here, we've hit max iterations - return the last result
  options.log(
    `Grats: Reached maximum iterations (${maxIterations}). Some issues may remain.`,
  );
  return resultFn();
}

/**
 * Apply fixes to source files and return the set of files that were changed.
 *
 * Returns true if any files were changed, false otherwise.
 */
export function applyFixes(
  fixableDiagnostics: FixableDiagnostic[],
  options: FixOptions,
): boolean {
  let appliedAnyFixes = false;

  // Group diagnostics by file to batch changes
  const diagnosticsByFile = new Map<string, FixableDiagnostic[]>();

  for (const diagnostic of fixableDiagnostics) {
    if (!diagnostic.fix) continue;

    for (const change of diagnostic.fix.changes) {
      const fileName = change.fileName;
      if (!diagnosticsByFile.has(fileName)) {
        diagnosticsByFile.set(fileName, []);
      }
      diagnosticsByFile.get(fileName)!.push(diagnostic);
    }
  }

  // Apply changes to each file
  for (const [fileName, fileDiagnostics] of diagnosticsByFile.entries()) {
    try {
      const content = readFileSync(fileName, "utf8");
      let newContent = content;

      // Collect all text changes for this file and sort by position in reverse order
      const allTextChanges: ts.TextChange[] = [];

      for (const diagnostic of fileDiagnostics) {
        if (!diagnostic.fix) continue;

        for (const fileChange of diagnostic.fix.changes) {
          if (fileChange.fileName === fileName) {
            for (const textChange of fileChange.textChanges) {
              allTextChanges.push(textChange);
            }
          }
        }
      }

      // Sort changes by position in reverse order to avoid offset issues
      allTextChanges.sort((a, b) => b.span.start - a.span.start);

      // Apply each change
      for (const change of allTextChanges) {
        const before = newContent.slice(0, change.span.start);
        const after = newContent.slice(change.span.start + change.span.length);
        newContent = before + change.newText + after;
      }

      writeFileSync(fileName, newContent, "utf8");
      appliedAnyFixes = true;
    } catch (error) {
      options.log(`Grats: Failed to apply fix to ${fileName}: ${error}`);
    }
  }

  // Report all fixes at the end
  for (const diagnostic of fixableDiagnostics) {
    if (diagnostic.fix) {
      const fileName = diagnostic.fix.changes[0]?.fileName;
      if (fileName) {
        options.log(
          `  * Applied fix "${diagnostic.fix.description}" in ${relativePath(fileName)}`,
        );
      }
    }
  }

  return appliedAnyFixes;
}
