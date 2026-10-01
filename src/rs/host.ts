import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

/**
 * What the Rust port of Grats asks of its host: access to the file system,
 * the current directory and the console. See `Host` in
 * `grats-rs/crates/grats/src/host.rs`.
 */
export type HostRequest =
  | { kind: "readFile"; path: string }
  | { kind: "stat"; path: string; followLinks: boolean }
  | { kind: "readLink"; path: string }
  | { kind: "realpath"; path: string }
  | { kind: "readDir"; path: string }
  | { kind: "currentDirectory" }
  | { kind: "writeFile"; path: string; contents: string }
  | { kind: "log"; message: string }
  | { kind: "logError"; message: string };

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

/** A path from Rust as the platform writes it. */
export function fromRustPath(rustPath: string): string {
  return rustPath.replace(/^\/(?=[A-Za-z]:)/, "");
}

export function host(): Host {
  return (request) => {
    switch (request.kind) {
      case "readFile":
        return ts.sys.readFile(fromRustPath(request.path)) ?? null;
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
      case "currentDirectory":
        return toRustPath(process.cwd());
      case "writeFile":
        try {
          fs.writeFileSync(fromRustPath(request.path), request.contents);
          return null;
        } catch (error) {
          return String(error);
        }
      case "log":
        console.log(request.message);
        return null;
      case "logError":
        console.error(request.message);
        return null;
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
