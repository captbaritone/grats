import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { GraphQLSchema } from "graphql";
import { ConfigOptions } from "./lib";

export function printGratsSchema(
  schema: GraphQLSchema,
  config: ConfigOptions,
): string {
  const sdl = printSchemaWithDirectives(schema, {
    assumeValid: true,
  });

  if (config.schemaHeader) {
    return `${config.schemaHeader}\n${sdl}`;
  }
  return sdl;
}
