import { relative, resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

// Grats parses TypeScript files and finds resolvers. If the field resolver is a
// named export, Grats needs to be able to import that file during execution.
//
// To achieve this, Grats annotates the field with a directive that includes
// the path to the module that contains the resolver. In order to allow those
// paths to be relative, they must be relative to something that both the build
// step and the runtime can agree on. This path is that thing.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find the project root by looking for package.json.
// Works from both source (src/) and compiled output (dist/src/).
function findGratsRoot(): string {
  let dir = __dirname;
  while (true) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error("Could not find grats project root");
    }
    dir = parent;
  }
}

const gratsRoot = findGratsRoot();

export function relativePath(absolute: string): string {
  return relative(gratsRoot, absolute);
}
export function resolveRelativePath(relativePath: string): string {
  return resolve(gratsRoot, relativePath);
}
