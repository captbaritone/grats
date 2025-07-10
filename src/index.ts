import * as ts from "typescript";
import type { ParsedCommandLineGrats } from "./gratsConfig.ts";
import { validateGratsOptions } from "./gratsConfig.ts";
import { ReportableDiagnostics } from "./utils/DiagnosticError.ts";
import { err, ok } from "./utils/Result.ts";
import type { Result } from "./utils/Result.ts";

export { printSDLWithoutMetadata } from "./printSchema.ts";
export * from "./Types.ts";
export * from "./lib.ts";
// Used by the experimental TypeScript plugin
export { extract } from "./Extractor.ts";
export { codegen } from "./codegen/schemaCodegen.ts";

// #FIXME: Report diagnostics instead of throwing!
export function getParsedTsConfig(
  configFile: string,
): Result<ParsedCommandLineGrats, ReportableDiagnostics> {
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
