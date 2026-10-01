import { DiagnosticsWithoutLocationResult } from "./utils/DiagnosticError.js";
import { ResultPipe } from "./utils/Result.js";
import type { GratsProject } from "./rs/project.js";
import { RustDocument, runRustPipeline } from "./rs/document.js";

export type { GratsConfig } from "./gratsConfig.js";

export type SchemaAndDoc = {
  /**
   * Stands for the document which Rust keeps (see `src/rs/document.ts`), so
   * it's what is printed.
   */
  doc: RustDocument;
};

/**
 * The core transformation pipeline of Grats.
 *
 * To keep the Grats codebase clean and maintainable, we've broken the
 * implementation into a series of transformations that each perform a small,
 * well-defined task.
 *
 * This function orchestrates the transformations and, as such, gives a good
 * high-level overview of how Grats works.
 */
// Exported for tests that want to intercept diagnostic errors.
export function buildSchemaAndDocResult(
  project: GratsProject,
): DiagnosticsWithoutLocationResult<SchemaAndDoc> {
  // Run the pipeline, which has been ported to Rust: finding the files of the
  // program and those which contain GraphQL definitions, checking each of
  // those files for syntax errors, extracting a snapshot from each file and
  // combining them, building the `TypeContext` and validating the snapshot,
  // filtering interfaces, resolving resolver params and types, and the
  // document transforms and validations, which end by validating the document
  // and the schema built from it with regards to the GraphQL spec. Rust keeps
  // the resulting document for printing.
  return new ResultPipe(runRustPipeline(project))
    .map((doc) => ({ doc }))
    .result();
}
