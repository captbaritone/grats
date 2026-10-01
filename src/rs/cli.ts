import { resolveRelativePath } from "../gratsRoot.js";
import { CodeFixAction, GratsDiagnostic } from "../utils/DiagnosticError.js";
import { host, toRustPath } from "./host.js";
import { callRust } from "./load.js";

/**
 * Applies the fixes of the diagnostics to their files, and logs each one.
 *
 * Returns true if any files were changed, false otherwise.
 */
export function applyFixes(
  diagnostics: GratsDiagnostic[],
  options: { log: (message: string) => void },
): boolean {
  const fixes: CodeFixAction[] = [];
  for (const { fix } of diagnostics) {
    if (fix == null) continue;
    fixes.push({
      ...fix,
      changes: fix.changes.map((change) => ({
        ...change,
        fileName: toRustPath(change.fileName),
      })),
    });
  }
  const request = { fixes, gratsRoot: toRustPath(resolveRelativePath(".")) };
  const result: { applied: boolean; log: string[] } = JSON.parse(
    callRust("apply_fixes", JSON.stringify(request), host()),
  );
  result.log.forEach((message) => options.log(message));
  return result.applied;
}
