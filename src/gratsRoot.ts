import { relative, resolve, join } from "path";

// Grats parses TypeScript files and finds resolvers. If the field resolver is a
// named export, Grats needs to be able to import that file during execution.
//
// To achieve this, Grats annotates the field with a directive that includes
// the path to the module that contains the resolver. In order to allow those
// paths to be relative, they must be relative to something that both the build
// step and the runtime can agree on. This path is that thing.
const gratsRoot = join(__dirname, "../..");

export function relativePath(absolute: string): string {
  return relative(gratsRoot, absolute);
}
export function resolveRelativePath(relativePath: string): string {
  return resolve(gratsRoot, relativePath);
}
