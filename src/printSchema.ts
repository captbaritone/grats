import { DocumentNode, GraphQLSchema } from "graphql";
import * as path from "path";
import { GratsConfig } from "./gratsConfig.js";
import { codegen } from "./codegen/schemaCodegen.js";
import { Metadata } from "./metadata.js";
import { resolverMapCodegen } from "./codegen/resolverMapCodegen.js";
import {
  encodeDocument,
  encodeOutputRequest,
  SourceTable,
} from "./rs/codec.js";
import { callRust } from "./rs/load.js";
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
 * into the Rust port of Grats once for all outputs.
 */
export function printOutputs(
  schemaAndDoc: SchemaAndDoc,
  config: GratsConfig,
  request: OutputRequest,
): Outputs {
  const { schema, doc, resolvers } = schemaAndDoc;
  const outputs: Outputs = {};
  if (request.tsSchema != null) {
    outputs.tsSchema = printExecutableSchema(
      schema,
      resolvers,
      config,
      request.tsSchema,
    );
  }
  if (request.graphqlSchema || request.tsClientEnums != null) {
    const printed: Outputs = JSON.parse(
      callRust(
        "print_outputs",
        encodeOutputRequest({
          doc,
          config,
          // Rust has no module location or working directory to resolve
          // paths against, so it's given absolute paths.
          gratsRoot: resolveRelativePath("."),
          graphqlSchema: request.graphqlSchema ?? false,
          tsClientEnums:
            request.tsClientEnums == null
              ? null
              : path.resolve(request.tsClientEnums),
        }),
      ),
    );
    Object.assign(outputs, printed);
  }
  return outputs;
}

/**
 * Prints code for a TypeScript module that exports a GraphQLSchema.
 * Includes the user-defined (or default) header comment if provided.
 */
function printExecutableSchema(
  schema: GraphQLSchema,
  resolvers: Metadata,
  config: GratsConfig,
  destination: string,
): string {
  const code = config.EXPERIMENTAL__emitResolverMap
    ? resolverMapCodegen(schema, resolvers, config, destination)
    : codegen(schema, resolvers, config, destination);
  return applyTypeScriptHeader(config, code);
}

function applyTypeScriptHeader(config: GratsConfig, code: string): string {
  return formatHeader(config.tsSchemaHeader, code);
}

export function printSDLWithoutMetadata(doc: DocumentNode): string {
  return callRust(
    "print_sdl_without_metadata",
    encodeDocument(doc, new SourceTable()),
  );
}

function formatHeader(header: string | null, code: string): string {
  if (header !== null) {
    return `${header}\n\n${code}`;
  }
  return code;
}
