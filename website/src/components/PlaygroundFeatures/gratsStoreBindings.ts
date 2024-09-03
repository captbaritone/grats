import { getConfig, getDoc, getView, State } from "./store";
import { codegen } from "grats/src/codegen";
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
import { print } from "graphql";
import { printSDLWithoutMetadata } from "grats/src/printSchema";
import store from "./store";

const SHOULD_CACHE = true;
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

  store.dispatch({ type: "TS_LOADED", system, fsMap });
}

export const getTs = (state: State) => state.ts;

export const getBuild = createSelector(
  getTs,
  getDoc,
  getConfig,
  (ts, doc, config) => {
    if (ts == null) return null;

    return build(ts.fsMap, ts.system, doc, config);
  },
);

export const getErrorText = createSelector(getBuild, (build) => {
  if (build == null) return null;

  if (build.kind === "ERROR") {
    return build.err.formatDiagnosticsWithContext();
  }
  return null;
});

export const getDiagnostics = createSelector(getBuild, (build) => {
  if (build == null) return [];

  if (build.kind === "ERROR") {
    return build.err._diagnostics;
  }
  return [];
});

export const getSchemaText = createSelector(
  getBuild,
  getView,
  (build, view) => {
    if (build == null) return "";

    if (build.kind === "OK") {
      const doc = build.value.doc;
      if (!view.showGratsDirectives) {
        return printSDLWithoutMetadata(doc);
      }
      return print(doc);
    }
    return null;
  },
);

export const getTsSchema = createSelector(
  getBuild,
  getConfig,
  (build, config) => {
    if (build == null) return "";

    if (build.kind === "OK") {
      return codegen(build.value.schema, config, "./schema.ts");
    }
    return null;
  },
);

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
