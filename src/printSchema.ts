import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { GraphQLSchema, printSchema } from "graphql";
import { ConfigOptions } from "./lib";

export function printGratsSchema(
  schema: GraphQLSchema,
  config: ConfigOptions,
  includeDirectives: boolean = true,
): string {
  const sdl = print(schema, includeDirectives);

  if (config.schemaHeader) {
    return `${config.schemaHeader}\n${sdl}`;
  }
  return sdl;
}

function print(schema: GraphQLSchema, includeDirectives: boolean): string {
  if (includeDirectives) {
    return printSchemaWithDirectives(schema, {
      assumeValid: true,
    });
  }
  return printSchema(
    new GraphQLSchema({
      ...schema.toConfig(),
      directives: [],
    }),
  );
}
