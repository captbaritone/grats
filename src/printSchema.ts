import { GraphQLSchema, printSchema } from "graphql";
import { ConfigOptions } from "./lib";
import { codegen } from "./codegen";

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
  if (config.tsSchemaHeader) {
    return `${config.tsSchemaHeader}\n${code}`;
  }
  return code;
}

/**
 * Prints SDL, potentially omitting directives depending upon the config.
 * Includes the user-defined (or default) header comment if provided.
 */
export function printGratsSDL(
  schema: GraphQLSchema,
  config: ConfigOptions,
): string {
  const sdl = printSDLWithoutDirectives(schema);

  if (config.schemaHeader) {
    return `${config.schemaHeader}\n${sdl}`;
  }
  return sdl;
}

export function printSDLWithoutDirectives(schema: GraphQLSchema): string {
  return printSchema(
    new GraphQLSchema({
      ...schema.toConfig(),
      // TODO: Only filter out our directives. Note that
      // the playground duplicates this logic.
      directives: [],
    }),
  );
}
