import {
  GraphQLSchema,
  lexicographicSortSchema,
  buildSchema as gqlBuildSchema,
} from "graphql";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import * as fs from "fs";
import * as ts from "typescript";
import { applyServerDirectives, buildSchemaResult } from "./lib";

export * from "./Types";
export * from "./lib";

type RuntimeOptions = {
  emitSchemaFile?: string;
};

// Build an executable schema from a set of files. Note that if extraction
// fails, this function will exit the process and print a helpful error
// message.
export function extractGratsSchemaAtRuntime(
  runtimeOptions: RuntimeOptions,
): GraphQLSchema {
  const parsedTsConfig = getParsedTsConfig();

  const schemaResult = buildSchemaResult(parsedTsConfig);
  if (schemaResult.kind === "ERROR") {
    console.error(schemaResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  }

  let runtimeSchema = schemaResult.value;
  if (runtimeOptions.emitSchemaFile) {
    runtimeSchema = lexicographicSortSchema(runtimeSchema);
    const sdl = printSchemaWithDirectives(runtimeSchema, { assumeValid: true });
    const filePath = runtimeOptions.emitSchemaFile ?? "./schema.graphql";
    fs.writeFileSync(filePath, sdl);
  }
  return runtimeSchema;
}

export function buildSchemaFromSDL(sdlFilePath: string): GraphQLSchema {
  const sdl = fs.readFileSync(sdlFilePath, "utf8");
  const schema = gqlBuildSchema(sdl);
  return applyServerDirectives(schema);
}

// #FIXME: Report diagnostics instead of throwing!
export function getParsedTsConfig(): ts.ParsedCommandLine {
  const configFile = ts.findConfigFile(process.cwd(), ts.sys.fileExists);

  if (!configFile) {
    throw new Error("Grats: Could not find tsconfig.json");
  }

  // https://github.com/microsoft/TypeScript/blob/46d70d79cd0dd00d19e4c617d6ebb25e9f3fc7de/src/compiler/watch.ts#L216
  const configFileHost: ts.ParseConfigFileHost = ts.sys as any;
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configFile,
    undefined,
    configFileHost,
  );

  if (!parsed || parsed.errors.length > 0) {
    throw new Error("Grats: Could not parse tsconfig.json");
  }

  return parsed;
}
