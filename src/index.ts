// LLM agent docs: See the llm-docs/ directory in the package root for
// Markdown documentation covering all Grats features and configuration.

import * as ts from "typescript";
import { ParsedCommandLineGrats, validateGratsOptions } from "./gratsConfig.js";
import { DiagnosticsWithoutLocationResult } from "./utils/DiagnosticError.js";
import { err } from "./utils/Result.js";

export { printSDLWithoutMetadata } from "./printSchema.js";
export * from "./Types.js";
export * from "./lib.js";
// Used by the experimental TypeScript plugin
export { extract } from "./Extractor.js";
export { codegen } from "./codegen/schemaCodegen.js";
export { ReportableDiagnostics } from "./utils/DiagnosticError.js";

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
