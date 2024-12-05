import {
  DocumentNode,
  GraphQLSchema,
  print,
  visit,
  specifiedScalarTypes,
} from "graphql";
import { GratsConfig } from "./gratsConfig";
import { codegen } from "./codegen";
import {
  METADATA_DIRECTIVE_NAMES,
  METADATA_INPUT_NAMES,
} from "./metadataDirectives";

/**
 * Prints code for a TypeScript module that exports a GraphQLSchema.
 * Includes the user-defined (or default) header comment if provided.
 */
export function printExecutableSchema(
  schema: GraphQLSchema,
  config: GratsConfig,
  destination: string,
): string {
  const code = codegen(schema, config, destination);
  return applyTypeScriptHeader(config, code);
}

export function applyTypeScriptHeader(
  config: GratsConfig,
  code: string,
): string {
  return formatHeader(config.tsSchemaHeader, code);
}

/**
 * Prints SDL, potentially omitting directives depending upon the config.
 * Includes the user-defined (or default) header comment if provided.
 */
export function printGratsSDL(doc: DocumentNode, config: GratsConfig): string {
  const sdl = printSDLWithoutMetadata(
    doc,
    config.EXPERIMENTAL__includeResolverDirective,
  );
  return applySDLHeader(config, sdl) + "\n";
}

export function applySDLHeader(config: GratsConfig, sdl: string): string {
  return formatHeader(config.schemaHeader, sdl);
}

export function printSDLWithoutMetadata(
  doc: DocumentNode,
  includeResolver: boolean = false,
): string {
  const trimmed = visit(doc, {
    DirectiveDefinition(t) {
      if (includeResolver && t.name.value === "resolver") {
        return t;
      }
      return METADATA_DIRECTIVE_NAMES.has(t.name.value) ? null : t;
    },
    Directive(t) {
      if (includeResolver && t.name.value === "resolver") {
        return t;
      }
      return METADATA_DIRECTIVE_NAMES.has(t.name.value) ? null : t;
    },
    InputObjectTypeDefinition(t) {
      if (!includeResolver && METADATA_INPUT_NAMES.has(t.name.value)) {
        return null;
      }
      return t;
    },
    ScalarTypeDefinition(t) {
      return specifiedScalarTypes.some((scalar) => scalar.name === t.name.value)
        ? null
        : t;
    },
  });
  return print(trimmed);
}

function formatHeader(header: string | null, code: string): string {
  if (header !== null) {
    return `${header}\n${code}`;
  }
  return code;
}
