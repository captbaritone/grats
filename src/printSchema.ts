import { DocumentNode, GraphQLSchema } from "graphql";
import { GratsConfig } from "./gratsConfig.js";
import { codegen } from "./codegen/schemaCodegen.js";
import { Metadata } from "./metadata.js";
import { resolverMapCodegen } from "./codegen/resolverMapCodegen.js";
import { codegenEnums } from "./codegen/enumCodegen.js";
import { encodeDocument, SourceTable } from "./rs/codec.js";
import { callRust } from "./rs/load.js";

/**
 * Prints code for a TypeScript module that exports a GraphQLSchema.
 * Includes the user-defined (or default) header comment if provided.
 */
export function printExecutableSchema(
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

export function applyTypeScriptHeader(
  config: GratsConfig,
  code: string,
): string {
  return formatHeader(config.tsSchemaHeader, code);
}

export function applyTypeScriptEnumHeader(
  config: GratsConfig,
  code: string,
): string {
  return formatHeader(config.tsClientEnumsHeader, code);
}

/**
 * Prints SDL, potentially omitting directives depending upon the config.
 * Includes the user-defined (or default) header comment if provided.
 */
export function printGratsSDL(doc: DocumentNode, config: GratsConfig): string {
  const sdl = printSDLWithoutMetadata(doc);
  return applySDLHeader(config, sdl) + "\n";
}

export function applySDLHeader(config: GratsConfig, sdl: string): string {
  return formatHeader(config.schemaHeader, sdl);
}

/**
 * Prints TypeScript code for a module that exports all enums.
 * Includes the user-defined (or default) header comment if provided.
 */
export function printEnumsModule(
  schema: GraphQLSchema,
  config: GratsConfig,
  destination: string,
): string {
  const code = codegenEnums(schema, config, destination);
  return applyTypeScriptEnumHeader(config, code);
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
