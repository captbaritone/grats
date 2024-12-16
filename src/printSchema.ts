import {
  DocumentNode,
  GraphQLSchema,
  print,
  visit,
  specifiedScalarTypes,
} from "graphql";
import { GratsConfig } from "./gratsConfig";
import { codegen } from "./codegen/schemaCodegen";
import { Metadata } from "./metadata";
import { resolverMapCodegen } from "./codegen/resolverMapCodegen";

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

export function printSDLWithoutMetadata(doc: DocumentNode): string {
  const trimmed = visit(doc, {
    ScalarTypeDefinition(t) {
      if (t.isExternalType) {
        return null;
      } else if (
        specifiedScalarTypes.some((scalar) => scalar.name === t.name.value)
      ) {
        return null;
      } else {
        return t;
      }
    },
    ObjectTypeDefinition(t) {
      if (t.isExternalType) {
        return null;
      } else {
        return t;
      }
    },
    InterfaceTypeDefinition(t) {
      if (t.isExternalType) {
        return null;
      } else {
        return t;
      }
    },
    ObjectTypeExtension(t) {
      if (t.isExternalType) {
        return null;
      } else {
        return t;
      }
    },
    UnionTypeDefinition(t) {
      if (t.isExternalType) {
        return null;
      } else {
        return t;
      }
    },
    EnumTypeDefinition(t) {
      if (t.isExternalType) {
        return null;
      } else {
        return t;
      }
    },
    InputObjectTypeDefinition(t) {
      if (t.isExternalType) {
        return null;
      } else {
        return t;
      }
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
