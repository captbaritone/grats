import { DocumentNode } from "graphql";
import * as path from "path";
import { GratsConfig } from "./gratsConfig.js";
import { callRustWithDocument } from "./rs/document.js";
import { resolveRelativePath } from "./gratsRoot.js";
import type { SchemaAndDoc } from "./lib.js";

/** The outputs for `printOutputs` to print. */
export type OutputRequest = {
  /** Print the SDL. */
  graphqlSchema?: boolean;
  /** Print the executable schema module, to be written to this path. */
  tsSchema?: string;
  /** Print the enums module, to be written to this path. */
  tsClientEnums?: string;
  /** Print the resolver metadata as JSON. See `src/metadata.ts`. */
  metadata?: boolean;
};

/** The printed outputs, for each output that was requested. */
export type Outputs = {
  graphqlSchema?: string;
  tsSchema?: string;
  tsClientEnums?: string;
  metadata?: string;
};

/**
 * Prints the requested outputs, each including the user-defined (or default)
 * header comment if provided.
 *
 * Rust prints them from the document it kept when `runRustPipeline` was
 * given it, so the document only crosses into the Rust port of Grats once.
 */
export function printOutputs(
  schemaAndDoc: SchemaAndDoc,
  config: GratsConfig,
  request: OutputRequest,
): Outputs {
  const { doc } = schemaAndDoc;
  if (
    !request.graphqlSchema &&
    request.tsSchema == null &&
    request.tsClientEnums == null &&
    !request.metadata
  ) {
    return {};
  }
  const { output } = callRustWithDocument("print_outputs", doc, {
    config,
    // Rust has no module location or working directory to resolve paths
    // against, so it's given absolute paths.
    gratsRoot: resolveRelativePath("."),
    graphqlSchema: request.graphqlSchema ?? false,
    tsSchema: request.tsSchema == null ? null : path.resolve(request.tsSchema),
    tsClientEnums:
      request.tsClientEnums == null
        ? null
        : path.resolve(request.tsClientEnums),
    metadata: request.metadata ?? false,
  });
  return JSON.parse(output);
}

export function printSDLWithoutMetadata(doc: DocumentNode): string {
  return callRustWithDocument("print_sdl_without_metadata", doc, null).output;
}
