import * as ts from "typescript";
import {
  DiagnosticsWithoutLocationResult,
  FixableDiagnostic,
} from "./utils/DiagnosticError";
import { writeFileSync, readFileSync } from "fs";
import { relativePath } from "./gratsRoot";

export type FixOptions = {
  fix: boolean;
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
      console.error(
        `\nGrats: Re-running with fixes applied (iteration ${iteration})...\n`,
      );
    }
    const result = resultFn();

    if (result.kind === "OK") {
      if (totalFixesApplied > 0 && iteration > 2) {
        const fixes = totalFixesApplied === 1 ? "fix" : "fixes total";
        console.error(`Grats: Applied ${totalFixesApplied} ${fixes}.`);
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
    console.error(
      `Grats: Identified ${fixableDiagnostics.length} fixable ${issues}:`,
    );

    // Apply fixes
    applyFixes(fixableDiagnostics);
    totalFixesApplied += fixableDiagnostics.length;
  }

  // If we reach here, we've hit max iterations - return the last result
  console.error(
    `Grats: Reached maximum iterations (${maxIterations}). Some issues may remain.`,
  );
  return resultFn();
}

/**
 * Apply fixes to source files and return the set of files that were changed.
 *
 * Returns true if any files were changed, false otherwise.
 */
export function applyFixes(fixableDiagnostics: FixableDiagnostic[]): boolean {
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
      const allTextChanges: { change: ts.TextChange; description: string }[] =
        [];

      for (const diagnostic of fileDiagnostics) {
        if (!diagnostic.fix) continue;

        const description = diagnostic.fix.description;
        for (const fileChange of diagnostic.fix.changes) {
          if (fileChange.fileName === fileName) {
            for (const textChange of fileChange.textChanges) {
              allTextChanges.push({ change: textChange, description });
            }
          }
        }
      }

      // Sort changes by position in reverse order to avoid offset issues
      allTextChanges.sort((a, b) => b.change.span.start - a.change.span.start);

      // Apply each change and log it
      for (const { change, description } of allTextChanges) {
        const before = newContent.slice(0, change.span.start);
        const after = newContent.slice(change.span.start + change.span.length);
        newContent = before + change.newText + after;

        console.error(
          `  * Applied fix "${description}" in ${relativePath(fileName)}`,
        );
      }

      writeFileSync(fileName, newContent, "utf8");
      appliedAnyFixes = true;
    } catch (error) {
      console.error(`Grats: Failed to apply fix to ${fileName}:`, error);
    }
  }

  return appliedAnyFixes;
}
