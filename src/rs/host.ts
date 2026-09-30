import { Source } from "graphql";
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import type { ParsedCommandLineGrats } from "../gratsConfig.js";
import type { SourceTable } from "./codec.js";

/**
 * What the Rust port of Grats asks of its host: access to the file system,
 * and the `SourceTable` which locations in its output refer to. See `Host` in
 * `grats-rs/crates/grats/src/host.rs`.
 */
export type HostRequest =
  | { kind: "readFile"; path: string }
  | { kind: "readSourceFile"; path: string }
  | { kind: "stat"; path: string; followLinks: boolean }
  | { kind: "readLink"; path: string }
  | { kind: "realpath"; path: string }
  | { kind: "addSource"; name: string; body: string };

/** A response to a `HostRequest`, as JSON. */
export type Host = (request: HostRequest) => unknown;

/**
 * A path as Rust is given it: absolute, with `/` as its separator. On
 * Windows, `C:\project` is given as `/C:/project`.
 */
function toRustPath(fileName: string): string {
  const slashed = path.resolve(fileName).replace(/\\/g, "/");
  return /^[A-Za-z]:/.test(slashed) ? `/${slashed}` : slashed;
}

/**
 * A path from Rust as TypeScript writes file names, so that sources are named
 * as they were when TypeScript read the files.
 */
function fromRustPath(rustPath: string): string {
  return rustPath.replace(/^\/(?=[A-Za-z]:)/, "");
}

export function host(sources: SourceTable): Host {
  return (request) => {
    switch (request.kind) {
      case "readFile":
        return ts.sys.readFile(fromRustPath(request.path)) ?? null;
      case "readSourceFile": {
        const fileName = fromRustPath(request.path);
        const text = ts.sys.readFile(fileName);
        if (text == null) {
          return null;
        }
        // Locations in diagnostics refer to the file by its name.
        const source = sources.sourceId(new Source(text, fileName));
        return { source, text };
      }
      case "stat": {
        const fileName = fromRustPath(request.path);
        const stats = request.followLinks
          ? fs.statSync(fileName, { throwIfNoEntry: false })
          : fs.lstatSync(fileName, { throwIfNoEntry: false });
        if (stats == null) {
          return null;
        }
        if (stats.isSymbolicLink()) {
          return "symlink";
        }
        if (stats.isFile()) {
          return "file";
        }
        return stats.isDirectory() ? "directory" : null;
      }
      case "readLink": {
        const fileName = fromRustPath(request.path);
        try {
          const target = fs.readlinkSync(fileName);
          return toRustPath(path.resolve(path.dirname(fileName), target));
        } catch {
          return null;
        }
      }
      case "realpath":
        try {
          return toRustPath(fs.realpathSync.native(fromRustPath(request.path)));
        } catch {
          return null;
        }
      case "addSource":
        return sources.sourceId(new Source(request.body, request.name));
    }
  };
}

/**
 * The options which decide the files of the program, as TypeScript computes
 * them. See `ProgramOptions` in `grats-rs/crates/grats/src/program.rs`.
 */
export type RustProgramOptions = {
  rootNames: string[];
  moduleResolution: number;
  moduleDetection: number;
  allowJs: boolean;
  customConditions: string[];
  paths: Array<[string, string[]]> | null;
  pathsBasePath: string | null;
  baseUrl: string | null;
  preserveSymlinks: boolean;
  useCaseSensitiveFileNames: boolean;
};

// TypeScript's internal helpers for reading compiler options, which
// `createProgram` uses.
const tsInternal = ts as unknown as {
  getEmitModuleResolutionKind(options: ts.CompilerOptions): number;
  getEmitModuleDetectionKind(options: ts.CompilerOptions): number;
  getAllowJSCompilerOption(options: ts.CompilerOptions): boolean;
};

export function rustProgramOptions(
  parsed: ParsedCommandLineGrats,
): RustProgramOptions {
  const options = parsed.options;
  const pathsBasePath =
    options.paths == null
      ? null
      : (options.baseUrl ??
        (options.pathsBasePath as string | undefined) ??
        ts.sys.getCurrentDirectory());
  return {
    rootNames: parsed.fileNames.map(toRustPath),
    moduleResolution: tsInternal.getEmitModuleResolutionKind(options),
    moduleDetection: tsInternal.getEmitModuleDetectionKind(options),
    allowJs: tsInternal.getAllowJSCompilerOption(options),
    customConditions: options.customConditions ?? [],
    paths: options.paths == null ? null : Object.entries(options.paths),
    pathsBasePath: pathsBasePath == null ? null : toRustPath(pathsBasePath),
    baseUrl: options.baseUrl == null ? null : toRustPath(options.baseUrl),
    preserveSymlinks: !!options.preserveSymlinks,
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  };
}
