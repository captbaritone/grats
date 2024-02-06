import {
  DocumentNode,
  GraphQLSchema,
  print,
  visit,
  specifiedScalarTypes,
} from "graphql";
import { ConfigOptions } from "./gratsConfig";
import { codegen } from "./codegen";
import { METADATA_DIRECTIVE_NAMES } from "./metadataDirectives";

/**
 * Prints code for a TypeScript module that exports a GraphQLSchema.
 * Includes the user-defined (or default) header comment if provided.
 */
export function printExecutableSchema(
  schema: GraphQLSchema,
  config: ConfigOptions,
  destination: string,
): string {
  const code = codegen(schema, destination);
  return applyTypeScriptHeader(config, code);
}

export function applyTypeScriptHeader(
  config: ConfigOptions,
  code: string,
): string {
  return formatHeader(config.tsSchemaHeader, code);
}

/**
 * Prints SDL, potentially omitting directives depending upon the config.
 * Includes the user-defined (or default) header comment if provided.
 */
export function printGratsSDL(
  doc: DocumentNode,
  config: ConfigOptions,
): string {
  const sdl = printSDLWithoutMetadata(doc);
  return applySDLHeader(config, sdl) + "\n";
}

export function applySDLHeader(config: ConfigOptions, sdl: string): string {
  return formatHeader(config.schemaHeader, sdl);
}

export function printSDLWithoutMetadata(doc: DocumentNode): string {
  const trimmed = visit(doc, {
    DirectiveDefinition(t) {
      return METADATA_DIRECTIVE_NAMES.has(t.name.value) ? null : t;
    },
    Directive(t) {
      return METADATA_DIRECTIVE_NAMES.has(t.name.value) ? null : t;
    },
    ScalarTypeDefinition(t) {
      return specifiedScalarTypes.some((scalar) => scalar.name === t.name.value)
        ? null
        : t;
    },
  });
  return print(trimmed);
}

function formatHeader(header: string | string[] | null, code: string): string {
  if (header !== null) {
    return `${Array.isArray(header) ? header.join("") : header}\n${code}`;
  }
  return code;
}
