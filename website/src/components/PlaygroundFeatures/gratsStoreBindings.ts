import { getConfig, getDoc, getView } from "./store";
import * as ts from "typescript";
import lzstring from "lz-string";
import {
  createDefaultMapFromCDN,
  createSystem,
  createVirtualCompilerHost,
} from "@typescript/vfs";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import { buildSchemaAndDocResultWithHost } from "grats/src/lib";
import GRATS_TYPE_DECLARATIONS from "!!raw-loader!grats/src/Types.ts";
import { createSelector } from "reselect";
import { printSDLWithoutMetadata } from "grats/src/printSchema";

const SHOULD_CACHE = false;
const GRATS_PATH = "/node_modules/grats/src/index.ts";

if (ExecutionEnvironment.canUseDOM) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.process = {
    // Grats depends upon calling path.resolver and path.relative
    // which depend upon process.cwd() being set.
    // Here we supply a fake cwd() function that returns the root
    cwd() {
      return "/";
    },
  };
}

export async function bindGratsToStore() {
  const fsMap = await createDefaultMapFromCDN(
    { target: ts.ScriptTarget.ES2021, lib: ["es2021"] },
    ts.version,
    SHOULD_CACHE,
    ts,
    lzstring,
  );

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

  const system = createSystem(fsMap);

  const getBuild = createSelector(getDoc, getConfig, (doc, config) => {
    return build(fsMap, system, doc, config);
  });

  const getErrorText = createSelector(getBuild, (build) => {
    if (build.kind === "ERROR") {
      const errorText = build.err.formatDiagnosticsWithContext();
      return `# ERROR MESSAGE\n# =============\n\n${commentLines(errorText)}`;
    }
    return null;
  });

  const getDiagnostics = createSelector(getBuild, (build) => {
    if (build.kind === "ERROR") {
      return build.err._diagnostics;
    }
    return [];
  });

  const getSchemaText = createSelector(getBuild, getView, (build, view) => {
    if (build.kind === "OK") {
      const doc = build.value.doc;
      if (!view.showGratsDirectives) {
        return printSDLWithoutMetadata(doc);
      }
      return print(doc);
    }
    return null;
  });

  return { getBuild, getErrorText, getDiagnostics, getSchemaText };
}

function commentLines(text: string): string {
  return text
    .split("\n")
    .map((line) => `# ${line}`)
    .join("\n");
}

function build(fsMap, system, text, config) {
  fsMap.set("index.ts", text);
  fsMap.set(GRATS_PATH, GRATS_TYPE_DECLARATIONS);
  fsMap.set(
    "/node_modules/graphql/index.ts",
    `
      export type GraphQLResolveInfo = any;
      `,
  );
  const compilerOpts = {
    allowJs: true,
    baseUrl: "./",
    paths: { grats: [GRATS_PATH] },
    lib: [...fsMap.keys()],
  };
  const host = createVirtualCompilerHost(system, compilerOpts, ts);

  const parsedOptions = {
    raw: {
      grats: config,
    },
    options: compilerOpts,
    fileNames: ["index.ts"],
    errors: [],
  };
  try {
    return buildSchemaAndDocResultWithHost(parsedOptions, host.compilerHost);
  } catch (e) {
    const message = `Grats playground bug encountered. Please report this error:\n\n ${e.stack}`;
    throw e;
    return {
      kind: "ERROR",
      err: {
        formatDiagnosticsWithContext: () => message,
        _diagnostics: [] as ts.Diagnostic[],
      },
    };
  }
}
