import * as ts from "typescript";
import type { GratsConfig } from "../gratsConfig.js";
import {
  DiagnosticsWithoutLocationResult,
  locationlessErr,
} from "../utils/DiagnosticError.js";
import { err, ok, Result } from "../utils/Result.js";
import { decodeDiagnostic, EncodedDiagnostic, SourceTable } from "./codec.js";
import { host, RustProgramOptions, toRustPath } from "./host.js";
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
 * about its Grats config.
 */
export function loadProject(
  configPath: string,
): DiagnosticsWithoutLocationResult<GratsProject> {
  const sources = new SourceTable();
  const request = {
    configPath: toRustPath(configPath),
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  };
  const result: Result<
    GratsProject & { warnings: string[] },
    EncodedDiagnostic[]
  > = JSON.parse(
    callRust("load_project", JSON.stringify(request), host(sources)),
  );
  if (result.kind === "ERROR") {
    return err(result.err.map((d) => decodeDiagnostic(d, sources)));
  }
  const { warnings, ...project } = result.value;
  warnings.forEach((warning) => console.warn(warning));
  return ok(project);
}

/**
 * Validates a Grats config, filling in defaults, and prints any warnings
 * about it.
 */
export function validateGratsOptions(
  options: unknown,
): Result<GratsConfig, ts.Diagnostic[]> {
  const result: Result<ValidatedConfig, string> = JSON.parse(
    callRust("validate_grats_options", JSON.stringify(options ?? null)),
  );
  if (result.kind === "ERROR") {
    return err([locationlessErr(result.err)]);
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
