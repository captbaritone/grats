import { DiagnosticsWithoutLocationResult } from "./utils/DiagnosticError.js";
import { ResultPipe } from "./utils/Result.js";
import * as ts from "typescript";
import { ParsedCommandLineGrats } from "./gratsConfig.js";
import { gratsSourceFilesFromProgram } from "./gratsSourceFiles.js";
import { RustDocument, runRustPipeline } from "./rs/document.js";

export type { GratsConfig } from "./gratsConfig.js";

export type SchemaAndDoc = {
  /**
   * Stands for the document which Rust keeps (see `src/rs/document.ts`), so
   * it's what is printed or located in.
   */
  doc: RustDocument;
};

// Construct a schema, using GraphQL schema language
// Exported for tests that want to intercept diagnostic errors.
export function buildSchemaAndDocResult(
  options: ParsedCommandLineGrats,
): DiagnosticsWithoutLocationResult<SchemaAndDoc> {
  // https://stackoverflow.com/a/66604532/1263117
  const compilerHost = ts.createCompilerHost(
    options.options,
    /* setParentNodes this is needed for finding jsDocs */
    true,
  );

  return buildSchemaAndDocResultWithHost(options, compilerHost);
}

export function buildSchemaAndDocResultWithHost(
  options: ParsedCommandLineGrats,
  compilerHost: ts.CompilerHost,
): DiagnosticsWithoutLocationResult<SchemaAndDoc> {
  const program = ts.createProgram(
    options.fileNames,
    options.options,
    compilerHost,
  );
  return extractSchemaAndDoc(options, program);
}

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
export function extractSchemaAndDoc(
  options: ParsedCommandLineGrats,
  program: ts.Program,
): DiagnosticsWithoutLocationResult<SchemaAndDoc> {
  return new ResultPipe(gratsSourceFilesFromProgram(program, options))
    .andThen((sourceFiles) => {
      const config = options.raw.grats;

      // Run the rest of the pipeline, which has been ported to Rust:
      // extracting a snapshot from each file and combining them, building the
      // `TypeContext` and validating the snapshot, filtering interfaces,
      // resolving resolver params and types, and the document transforms and
      // validations, which end by validating the document and the schema
      // built from it with regards to the GraphQL spec. Rust keeps the
      // resulting document for printing.
      return runRustPipeline(sourceFiles, config, program);
    })
    .map((doc) => ({ doc }))
    .result();
}
