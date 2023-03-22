import {
  GraphQLSchema,
  lexicographicSortSchema,
  buildSchema as gqlBuildSchema,
} from "graphql";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import * as fs from "fs";
import { applyServerDirectives, BuildOptions, buildSchemaResult } from "./lib";

export * from "./Types";
export * from "./lib";

// Build an executable schema from a set of files. Note that if extraction
// fails, this function will exit the process and print a helpful error
// message.
export function buildSchema(options: BuildOptions): GraphQLSchema {
  const schemaResult = buildSchemaResult(options);
  if (schemaResult.kind === "ERROR") {
    console.error(schemaResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  }

  let runtimeSchema = schemaResult.value;
  if (options.emitSchemaFile) {
    runtimeSchema = lexicographicSortSchema(runtimeSchema);
    const sdl = printSchemaWithDirectives(runtimeSchema, { assumeValid: true });
    const filePath = options.emitSchemaFile ?? "./schema.graphql";
    fs.writeFileSync(filePath, sdl);
  }
  return runtimeSchema;
}

export function buildSchemaFromSDL(sdlFilePath: string): GraphQLSchema {
  const sdl = fs.readFileSync(sdlFilePath, "utf8");
  const schema = gqlBuildSchema(sdl);
  return applyServerDirectives(schema);
}
