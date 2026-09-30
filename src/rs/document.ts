import type { GratsConfig } from "../gratsConfig.js";
import { resolveRelativePath } from "../gratsRoot.js";
import { DiagnosticsWithoutLocationResult } from "../utils/DiagnosticError.js";
import { err, ok, Result } from "../utils/Result.js";
import {
  decodeDiagnostic,
  EncodedDiagnostic,
  RustDocumentRequests,
  RustPipelineRequest,
  SourceTable,
} from "./codec.js";
import { callRust, instanceId } from "./load.js";
import * as ts from "typescript";
import { hostPath, programHost } from "./host.js";

/**
 * Calls the Rust entry points which use the document the pipeline produced.
 *
 * Every caller runs the pipeline, which has been ported to Rust, and then
 * prints the resulting document (or locates an entity in it). So if the
 * document is valid, `run_pipeline` keeps it for the calls which follow, and
 * it never crosses into TypeScript. A `RustDocument` stands for the document
 * Rust keeps.
 */
export type RustDocument = {
  /** The sources that locations in Rust's output are encoded against. */
  readonly sources: SourceTable;
  /** Rust loses the document if its instance is replaced. */
  readonly instance: number;
};

// The document Rust is keeping, if any.
let kept: RustDocument | null = null;

/**
 * Runs the pipeline, which has been ported to Rust, on the files which
 * contain GraphQL definitions: extraction, then the transforms and
 * validations. See `run` in `grats-rs/crates/grats/src/pipeline.rs`.
 */
export function runRustPipeline(
  sourceFiles: readonly ts.SourceFile[],
  config: GratsConfig,
  program: ts.Program,
): DiagnosticsWithoutLocationResult<RustDocument> {
  kept = null;
  const sources = new SourceTable();
  const request: RustPipelineRequest = {
    config,
    // Rust has no module location to resolve paths against, so it's given
    // an absolute path.
    gratsRoot: resolveRelativePath("."),
    files: sourceFiles.map((sourceFile) => hostPath(sourceFile.fileName)),
  };
  const result: Result<null, EncodedDiagnostic[]> = JSON.parse(
    callRust(
      "run_pipeline",
      JSON.stringify(request),
      programHost(program, sources),
    ),
  );
  if (result.kind === "ERROR") {
    return err(result.err.map((d) => decodeDiagnostic(d, sources)));
  }
  kept = { sources, instance: instanceId() };
  return ok(kept);
}

/**
 * Calls an entry point with the document Rust kept when `runRustPipeline`
 * returned `doc`. Returns its output along with the sources to decode
 * locations in the output with.
 */
export function callRustWithDocument<E extends keyof RustDocumentRequests>(
  entryPoint: E,
  doc: RustDocument,
  request: RustDocumentRequests[E],
): { output: string; sources: SourceTable } {
  // Rust only keeps the document from the last `run_pipeline` call, and loses
  // it if its instance is replaced.
  if (kept !== doc || doc.instance !== instanceId()) {
    throw new Error(
      "Expected the document from the last call to `runRustPipeline`.",
    );
  }
  const output = callRust(entryPoint, JSON.stringify(request));
  return { output, sources: doc.sources };
}
