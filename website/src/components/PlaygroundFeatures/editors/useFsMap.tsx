import { useState, useEffect } from "react";
import * as ts from "typescript";
import lzstring from "lz-string";
import { createDefaultMapFromCDN } from "@typescript/vfs";

export function useFsMap() {
  const [fsMap, setFsMap] = useState<Map<string, string> | null>(null);

  useEffect(() => {
    let unmounted = false;
    const shouldCache = false;
    createDefaultMapFromCDN(
      { target: ts.ScriptTarget.ES2021, lib: ["es2021"] },
      ts.version,
      shouldCache,
      ts,
      lzstring,
    ).then((fsMap) => {
      if (!unmounted) {
        // There's some bug/mismatch where the files that are expected by our version of
        // TypeScript don't exactly match those included in/accessible by the
        // `@typescript/vfs` package. If it's missing a file it crashes, so we'll
        // include them as empty for now. Their actual contents are just a few very
        // obscure APIs, so it's probably fine to just leave them for now.
        for (const fileName of [
          "/lib.es2016.intl.d.ts",
          "/lib.dom.asynciterable.d.ts",
        ]) {
          fsMap.set(fileName, "");
        }
        setFsMap(fsMap);
      }
    });

    return () => {
      unmounted = true;
    };
  }, []);

  return fsMap;
}
