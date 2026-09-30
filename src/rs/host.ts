import { Source } from "graphql";
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
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
  | { kind: "readDir"; path: string }
  | { kind: "addSource"; name: string; body: string };

/** A response to a `HostRequest`, as JSON. */
export type Host = (request: HostRequest) => unknown;

/**
 * A path as Rust is given it: absolute, with `/` as its separator. On
 * Windows, `C:\project` is given as `/C:/project`.
 */
export function toRustPath(fileName: string): string {
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
      case "readDir": {
        const fileName = fromRustPath(request.path);
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(fileName, { withFileTypes: true });
        } catch {
          return null;
        }
        const files: string[] = [];
        const directories: string[] = [];
        for (const entry of entries) {
          let stats: fs.Stats | fs.Dirent | undefined = entry;
          if (entry.isSymbolicLink()) {
            stats = fs.statSync(path.join(fileName, entry.name), {
              throwIfNoEntry: false,
            });
          }
          if (stats?.isFile()) {
            files.push(entry.name);
          } else if (stats?.isDirectory()) {
            directories.push(entry.name);
          }
        }
        return { files: files.sort(), directories: directories.sort() };
      }
      case "addSource":
        return sources.sourceId(new Source(request.body, request.name));
    }
  };
}

/**
 * What decides the files of the program. See `ProgramOptions` in
 * `grats-rs/crates/grats/src/program.rs`.
 */
export type RustProgramOptions = {
  rootNames: string[];
  allowJs: boolean;
  tsconfig: string | null;
  useCaseSensitiveFileNames: boolean;
};
