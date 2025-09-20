import * as ts from "typescript";
/** Data structure representing the cached results of running Grats */

type Version = string;

export type RunCache = Map<string, Version>;

export function cacheFromProgram(program: ts.Program): RunCache {
  const cache: RunCache = new Map();
  program.getSourceFiles().forEach((sourceFile) => {
    // @ts-expect-error Version is not documented but it exists.
    const version = sourceFile.version;
    cache.set(sourceFile.fileName, version);
  });
  return cache;
}

export function cachesAreEqual(
  a: RunCache,
  b: RunCache,
  ignorePaths: Set<string>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (b.get(key) !== value && !ignorePaths.has(key)) {
      return false;
    }
  }
  return true;
}
