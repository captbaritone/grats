import { resolveRelativePath } from "../gratsRoot.js";
import {
  DiagnosticsWithoutLocationResult,
  GratsDiagnostic,
} from "../utils/DiagnosticError.js";
import { err, ok, Result } from "../utils/Result.js";
import { RustDocumentRequests, RustPipelineRequest } from "./codec.js";
import { callRust, instanceId } from "./load.js";
import { host } from "./host.js";
import type { GratsProject } from "./project.js";

/**
 * Calls the Rust entry points which use the document the pipeline produced.
 *
 * Every caller runs the pipeline, which has been ported to Rust, and then
 * prints the resulting document. So if the document is valid, `run_pipeline`
 * keeps it for the calls which follow, and it never crosses into TypeScript.
 * A `RustDocument` stands for the document Rust keeps.
 */
export type RustDocument = {
  /** Rust loses the document if its instance is replaced. */
  readonly instance: number;
};

// The document Rust is keeping, if any.
let kept: RustDocument | null = null;

/**
 * Runs the pipeline, which has been ported to Rust: finding the files of the
 * program and those which contain GraphQL definitions, extraction, then the
 * transforms and validations. See `run` in
 * `grats-rs/crates/grats/src/pipeline.rs`.
 */
export function runRustPipeline(
  project: GratsProject,
): DiagnosticsWithoutLocationResult<RustDocument> {
  kept = null;
  const request: RustPipelineRequest = {
    config: project.config,
    // Rust has no module location to resolve paths against, so it's given
    // an absolute path.
    gratsRoot: resolveRelativePath("."),
    program: project.program,
  };
  const result: Result<null, GratsDiagnostic[]> = JSON.parse(
    callRust("run_pipeline", JSON.stringify(request), host()),
  );
  if (result.kind === "ERROR") {
    return err(result.err);
  }
  kept = { instance: instanceId() };
  return ok(kept);
}

/**
 * Calls an entry point with the document Rust kept when `runRustPipeline`
 * returned `doc`, and returns its output.
 */
export function callRustWithDocument<E extends keyof RustDocumentRequests>(
  entryPoint: E,
  doc: RustDocument,
  request: RustDocumentRequests[E],
): string {
  // Rust only keeps the document from the last `run_pipeline` call, and loses
  // it if its instance is replaced.
  if (kept !== doc || doc.instance !== instanceId()) {
    throw new Error(
      "Expected the document from the last call to `runRustPipeline`.",
    );
  }
  return callRust(entryPoint, JSON.stringify(request), host());
}
