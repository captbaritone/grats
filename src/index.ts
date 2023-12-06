import {
  GraphQLSchema,
  lexicographicSortSchema,
  buildSchema as gqlBuildSchema,
} from "graphql";
import * as fs from "fs";
import * as ts from "typescript";
import {
  ParsedCommandLineGrats,
  applyServerDirectives,
  buildSchemaResult,
  validateGratsOptions,
} from "./lib";
import { printGratsSDL } from "./printSchema";
import {
  ReportableDiagnostics,
  Result,
  err,
  ok,
} from "./utils/DiagnosticError";

export * from "./Types";
export * from "./lib";
export { codegen } from "./codegen";

type RuntimeOptions = {
  emitSchemaFile?: string;
};

// Build an executable schema from a set of files. Note that if extraction
// fails, this function will exit the process and print a helpful error
// message.
export function extractGratsSchemaAtRuntime(
  runtimeOptions: RuntimeOptions,
): GraphQLSchema {
  const configFile = ts.findConfigFile(process.cwd(), ts.sys.fileExists);
  if (configFile == null) {
    throw new Error("Grats: Could not find tsconfig.json");
  }
  const tsConfigResult = getParsedTsConfig(configFile);
  if (tsConfigResult.kind === "ERROR") {
    console.error(tsConfigResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  }

  const parsedTsConfig = tsConfigResult.value;

  const schemaResult = buildSchemaResult(parsedTsConfig);
  if (schemaResult.kind === "ERROR") {
    console.error(schemaResult.err.formatDiagnosticsWithColorAndContext());
    process.exit(1);
  }

  let runtimeSchema = schemaResult.value;
  if (runtimeOptions.emitSchemaFile) {
    runtimeSchema = lexicographicSortSchema(runtimeSchema);
    const sdl = printGratsSDL(runtimeSchema, parsedTsConfig.raw.grats);
    const filePath = runtimeOptions.emitSchemaFile;
    fs.writeFileSync(filePath, sdl);
  }
  return runtimeSchema;
}

export function buildSchemaFromSDL(sdl: string): GraphQLSchema {
  const schema = gqlBuildSchema(sdl);
  return applyServerDirectives(schema);
}

// #FIXME: Report diagnostics instead of throwing!
export function getParsedTsConfig(
  configFile: string,
): Result<ParsedCommandLineGrats, ReportableDiagnostics> {
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

  if (!parsed) {
    throw new Error("Grats: Could not locate tsconfig.json");
  }

  if (parsed.errors.length > 0) {
    return err(ReportableDiagnostics.fromDiagnostics(parsed.errors));
  }

  return ok(validateGratsOptions(parsed));
}
