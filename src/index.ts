import * as ts from "typescript";
import { ParsedCommandLineGrats, validateGratsOptions } from "./gratsConfig";
import { DiagnosticsWithoutLocationResult } from "./utils/DiagnosticError";
import { err } from "./utils/Result";

export { printSDLWithoutMetadata } from "./printSchema";
export * from "./Types";
export * from "./lib";
// Used by the experimental TypeScript plugin
export { extract } from "./Extractor";
export { codegen } from "./codegen/schemaCodegen";
export { ReportableDiagnostics } from "./utils/DiagnosticError";

// #FIXME: Report diagnostics instead of throwing!
export function getParsedTsConfig(
  configFile: string,
): DiagnosticsWithoutLocationResult<ParsedCommandLineGrats> {
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
    return err(parsed.errors);
  }

  return validateGratsOptions(parsed);
}
