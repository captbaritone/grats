import * as ts from "typescript";
import type { GratsConfig } from "../gratsConfig.js";
import {
  DiagnosticsWithoutLocationResult,
  GratsDiagnostic,
} from "../utils/DiagnosticError.js";
import { err, ok, Result } from "../utils/Result.js";
import { fromRustPath, host, RustProgramOptions, toRustPath } from "./host.js";
import { callRust } from "./load.js";

/**
 * A project: its Grats config and what decides the files of its program. See
 * `Project` in `grats-rs/crates/grats/src/project.rs`.
 */
export type GratsProject = {
  config: GratsConfig;
  program: RustProgramOptions;
};

type ValidatedConfig = { config: GratsConfig; warnings: string[] };

/**
 * Reads the project a `tsconfig.json` describes, and prints any warnings
 * about its Grats config. Without a `configPath`, the `tsconfig.json` is
 * found in the current directory or the closest directory above it.
 */
export function loadProject(
  configPath: string | undefined,
): DiagnosticsWithoutLocationResult<{
  configPath: string;
  project: GratsProject;
}> {
  const request = {
    configPath: configPath == null ? null : toRustPath(configPath),
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  };
  const result: Result<
    GratsProject & { configPath: string; warnings: string[] },
    GratsDiagnostic[]
  > = JSON.parse(callRust("load_project", JSON.stringify(request), host()));
  if (result.kind === "ERROR") {
    return err(result.err);
  }
  const { warnings, configPath: rustConfigPath, ...project } = result.value;
  warnings.forEach((warning) => console.warn(warning));
  return ok({ configPath: fromRustPath(rustConfigPath), project });
}

/**
 * Validates a Grats config, filling in defaults, and prints any warnings
 * about it.
 */
export function validateGratsOptions(
  options: unknown,
): DiagnosticsWithoutLocationResult<GratsConfig> {
  const result: Result<ValidatedConfig, GratsDiagnostic[]> = JSON.parse(
    callRust("validate_grats_options", JSON.stringify(options ?? null)),
  );
  if (result.kind === "ERROR") {
    return err(result.err);
  }
  result.value.warnings.forEach((warning) => console.warn(warning));
  return ok(result.value.config);
}

/** A project with the given root files and no `tsconfig.json`. */
export function projectFromFiles(
  fileNames: string[],
  config: GratsConfig,
): GratsProject {
  return {
    config,
    program: {
      rootNames: fileNames.map(toRustPath),
      allowJs: false,
      tsconfig: null,
      useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    },
  };
}
