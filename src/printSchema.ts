import { DocumentNode } from "graphql";
import * as path from "path";
import { GratsConfig } from "./gratsConfig.js";
import { encodeDocument, SourceTable } from "./rs/codec.js";
import { callRust } from "./rs/load.js";
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
};

/** The printed outputs, for each output that was requested. */
export type Outputs = {
  graphqlSchema?: string;
  tsSchema?: string;
  tsClientEnums?: string;
};

/**
 * Prints the requested outputs, each including the user-defined (or default)
 * header comment if provided.
 *
 * Everything Grats prints goes through here, so that the document crosses
 * into the Rust port of Grats once for all outputs. (A document that was
 * validated by `validateDocument` doesn't need to cross again.)
 */
export function printOutputs(
  schemaAndDoc: SchemaAndDoc,
  config: GratsConfig,
  request: OutputRequest,
): Outputs {
  const { doc, resolvers } = schemaAndDoc;
  if (
    !request.graphqlSchema &&
    request.tsSchema == null &&
    request.tsClientEnums == null
  ) {
    return {};
  }
  const { output } = callRustWithDocument("print_outputs", doc, {
    resolvers,
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
  });
  return JSON.parse(output);
}

export function printSDLWithoutMetadata(doc: DocumentNode): string {
  return callRust(
    "print_sdl_without_metadata",
    encodeDocument(doc, new SourceTable()),
  );
}
