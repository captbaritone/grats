import { createSystem, createVirtualCompilerHost } from "@typescript/vfs";
import * as ts from "typescript";
import { buildSchemaAndDocResultWithHost, GratsConfig } from "grats/src/lib";
import GRATS_TYPE_DECLARATIONS from "!!raw-loader!grats/src/Types.ts";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";

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

export function buildSchemaResultWithFsMap(
  fsMap: Map<string, string>,
  text: string,
  config: GratsConfig,
) {
  fsMap.set("index.ts", text);
  fsMap.set(GRATS_PATH, GRATS_TYPE_DECLARATIONS);
  fsMap.set(
    "/node_modules/graphql/index.ts",
    `
    export type GraphQLResolveInfo = any;
    `,
  );
  // fsMap.set(GRATS_PACKAGE_JSON_PATH, GRATS_PACKAGE_JSON);
  // TODO: Don't recreate the system each time!
  const system = createSystem(fsMap);

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
