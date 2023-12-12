import { relative, resolve, join } from "path";
import * as ts from "typescript";

// Grats parses TypeScript files and finds resolvers. If the field resolver is a
// named export, Grats needs to be able to import that file during execution.
//
// To achieve this, Grats annotates the field with a directive that includes
// the path to the module that contains the resolver. In order to allow those
// paths to be relative, they must be relative to something that both the build

// step and the runtime can agree on. This path is that thing.
const gratsRoot = join(__dirname, "../..");

export function getRelativeOutputPath(
  options: ts.ParsedCommandLine,
  sourceFile: ts.SourceFile,
): string {
  const fileNames = ts.getOutputFileNames(options, sourceFile.fileName, true);

  // ts.getOutputFileNames returns a list of files that includes both the .d.ts
  // and .js files.
  const jsFileNames = fileNames.filter((fileName) => fileName.endsWith(".js"));

  if (jsFileNames.length !== 1) {
    throw new Error(
      `Grats: Expected ts.getOutputFileNames to return exactly one \`.js\` file. ` +
        `Found ${jsFileNames.length}}. This is a bug in Grats. I'd appreciate it if ` +
        `you could open an issue.`,
    );
  }

  return relative(gratsRoot, sourceFile.fileName);
}

export function resolveRelativePath(relativePath: string): string {
  return resolve(gratsRoot, relativePath);
}
