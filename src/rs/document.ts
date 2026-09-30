import { DocumentNode } from "graphql";
import type { GratsConfig } from "../gratsConfig.js";
import { DiagnosticsWithoutLocationResult } from "../utils/DiagnosticError.js";
import { err, ok, Result } from "../utils/Result.js";
import {
  decodeDiagnostic,
  EncodedDiagnostic,
  encodeDocumentRequest,
  RustDocumentRequests,
  RustPipelineRequest,
  SourceTable,
} from "./codec.js";
import { callRust, instanceId } from "./load.js";
import type { ExtractionSnapshot } from "../Extractor.js";
import * as ts from "typescript";
import { programHost } from "./host.js";

/**
 * Calls the Rust entry points which take a document.
 *
 * Every caller runs the part of the pipeline which has been ported to Rust on
 * a document, and then prints the result (or locates an entity in it). So if
 * the document is valid, `run_pipeline` keeps the document it transformed for
 * the calls which follow. That way the document is only encoded and sent to
 * Rust once. The TypeScript document stands for the one Rust keeps.
 */

// The document Rust is keeping, if any, and the sources its locations were
// encoded against.
let kept: {
  doc: DocumentNode;
  sources: SourceTable;
  instance: number;
} | null = null;

/**
 * Runs the part of the pipeline which has been ported to Rust on the combined
 * snapshot, whose definitions are `doc`: transforms and validations. See `run`
 * in `grats-rs/crates/grats/src/pipeline.rs`.
 */
export function runRustPipeline(
  doc: DocumentNode,
  config: GratsConfig,
  snapshot: ExtractionSnapshot,
  program: ts.Program,
): DiagnosticsWithoutLocationResult<DocumentNode> {
  kept = null;
  const sources = new SourceTable();
  const request: RustPipelineRequest = {
    config,
    snapshot: {
      unresolvedNames: Array.from(snapshot.unresolvedNames),
      nameDefinitions: Array.from(snapshot.nameDefinitions),
      implicitNameDefinitions: Array.from(snapshot.implicitNameDefinitions),
      typesWithTypename: Array.from(snapshot.typesWithTypename),
      interfaceDeclarations: snapshot.interfaceDeclarations,
    },
  };
  const result: Result<null, EncodedDiagnostic[]> = JSON.parse(
    callRust(
      "run_pipeline",
      encodeDocumentRequest(doc, request, sources),
      programHost(program, sources),
    ),
  );
  if (result.kind === "ERROR") {
    return err(result.err.map((d) => decodeDiagnostic(d, sources)));
  }
  kept = { doc, sources, instance: instanceId() };
  return ok(doc);
}

/**
 * Calls an entry point with the document Rust kept when `runRustPipeline`
 * was given `doc`. Returns its output along with the sources to decode
 * locations in the output with.
 */
export function callRustWithDocument<E extends keyof RustDocumentRequests>(
  entryPoint: E,
  doc: DocumentNode,
  request: RustDocumentRequests[E],
): { output: string; sources: SourceTable } {
  // Rust only keeps the document from the last `run_pipeline` call, and loses
  // it if its instance is replaced.
  if (kept?.doc !== doc || kept.instance !== instanceId()) {
    throw new Error(
      "Expected the document from the last call to `runRustPipeline`.",
    );
  }
  const { sources } = kept;
  const output = callRust(entryPoint, JSON.stringify(request));
  return { output, sources };
}
