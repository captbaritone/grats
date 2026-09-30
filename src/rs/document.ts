import { DocumentNode } from "graphql";
import type { GratsConfig } from "../gratsConfig.js";
import { DiagnosticsWithoutLocationResult } from "../utils/DiagnosticError.js";
import { err, ok, Result } from "../utils/Result.js";
import {
  decodeDiagnostic,
  EncodedDiagnostic,
  encodeDocumentRequest,
  RustDocumentRequests,
  RustValidateRequest,
  SourceTable,
} from "./codec.js";
import { callRust, instanceId } from "./load.js";

/**
 * Calls the Rust entry points which take a document.
 *
 * Every caller validates a document and then prints it (or locates an entity
 * in it), so `validate` keeps a valid document for the next call which uses
 * it. That way the document is only encoded and sent to Rust once.
 */

// The document Rust is keeping, if any, and the sources its locations were
// encoded against.
let validated: {
  doc: DocumentNode;
  sources: SourceTable;
  instance: number;
} | null = null;

/**
 * Runs the validations that have been ported to Rust. See `validate` in
 * `grats-rs/crates/grats/src/pipeline.rs`.
 */
export function validateDocument(
  doc: DocumentNode,
  config: GratsConfig,
  typesWithTypename: Set<string>,
): DiagnosticsWithoutLocationResult<DocumentNode> {
  validated = null;
  const sources = new SourceTable();
  const request: RustValidateRequest = {
    config,
    typesWithTypename: Array.from(typesWithTypename),
  };
  const result: Result<null, EncodedDiagnostic[]> = JSON.parse(
    callRust("validate", encodeDocumentRequest(doc, request, sources)),
  );
  if (result.kind === "ERROR") {
    return err(result.err.map((d) => decodeDiagnostic(d, sources)));
  }
  validated = { doc, sources, instance: instanceId() };
  return ok(doc);
}

/**
 * Calls an entry point with a document. Returns its output along with the
 * sources to decode locations in the output with.
 */
export function callRustWithDocument<E extends keyof RustDocumentRequests>(
  entryPoint: E,
  doc: DocumentNode,
  request: RustDocumentRequests[E],
): { output: string; sources: SourceTable } {
  if (validated?.doc === doc && validated.instance === instanceId()) {
    const { sources } = validated;
    validated = null;
    const output = callRust(
      entryPoint,
      encodeDocumentRequest(null, request, sources),
    );
    return { output, sources };
  }
  const sources = new SourceTable();
  const output = callRust(
    entryPoint,
    encodeDocumentRequest(doc, request, sources),
  );
  return { output, sources };
}
