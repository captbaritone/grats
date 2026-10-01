import * as ts from "typescript";
import type { GratsConfig } from "../gratsConfig.js";
import { resolveRelativePath } from "../gratsRoot.js";
import {
  CodeFixAction,
  DiagnosticsWithoutLocationResult,
  GratsDiagnostic,
} from "../utils/DiagnosticError.js";
import { RustDocument, callRustWithDocument } from "./document.js";
import { host, toRustPath } from "./host.js";
import { callRust } from "./load.js";

/**
 * What to do once the CLI has run. See `CliOutcome` in
 * `grats-rs/crates/grats/src/cli.rs`.
 */
export type CliOutcome =
  | { kind: "exit"; code: number }
  | { kind: "watch"; tsconfig: string | null; fix: boolean };

/**
 * Parses the arguments (after the program's name) and runs the command,
 * which has been ported to Rust. Watch mode is still TypeScript, so for
 * `--watch` the caller starts it.
 */
export function runCli(args: string[], version: string): CliOutcome {
  const request = {
    args,
    version,
    gratsRoot: toRustPath(resolveRelativePath(".")),
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  };
  return JSON.parse(callRust("run_cli", JSON.stringify(request), host()));
}

/**
 * Writes the outputs of the document to the paths in the config, which are
 * relative to the `tsconfig.json` at `configPath`, and reports each one.
 */
export function writeSchemaFiles(
  doc: RustDocument,
  config: GratsConfig,
  configPath: string,
): DiagnosticsWithoutLocationResult<null> {
  return JSON.parse(
    callRustWithDocument("write_schema_files", doc, {
      config,
      configPath: toRustPath(configPath),
      gratsRoot: toRustPath(resolveRelativePath(".")),
    }),
  );
}

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
