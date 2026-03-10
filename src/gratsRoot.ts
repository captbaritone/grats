import { relative, resolve, join, dirname } from "path";
import { fileURLToPath } from "url";

// Grats parses TypeScript files and finds resolvers. If the field resolver is a
// named export, Grats needs to be able to import that file during execution.
//
// To achieve this, Grats annotates the field with a directive that includes
// the path to the module that contains the resolver. In order to allow those
// paths to be relative, they must be relative to something that both the build
// step and the runtime can agree on. This path is that thing.

// This file lives at src/gratsRoot.ts (source) or dist/src/gratsRoot.js
// (compiled). In both cases, going up two levels reaches the project root.
// In the browser (webpack playground), fileURLToPath may not be available
// since the `url` module is stubbed out via webpack fallback.
const gratsRoot =
  typeof fileURLToPath === "function"
    ? join(dirname(fileURLToPath(import.meta.url)), "../..")
    : ".";

export function relativePath(absolute: string): string {
  return relative(gratsRoot, absolute);
}
export function resolveRelativePath(relativePath: string): string {
  return resolve(gratsRoot, relativePath);
}
