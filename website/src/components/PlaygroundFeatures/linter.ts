import { createSystem, createVirtualCompilerHost } from "@typescript/vfs";
import * as ts from "typescript";
import { buildSchemaAndDocResultWithHost, GratsConfig } from "grats/src/lib";
import { codegen } from "grats/src/codegen";
import { ReportableDiagnostics } from "grats/src/utils/DiagnosticError";
import { printSDLWithoutMetadata } from "grats/src/printSchema";
import { linter } from "@codemirror/lint";
import { DocumentNode, GraphQLSchema, print } from "graphql";
import GRATS_TYPE_DECLARATIONS from "!!raw-loader!grats/src/Types.ts";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";

import store from "./store";

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

function buildSchemaResultWithFsMap(
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
        _diagnostics: [] as ReportableDiagnostics[],
      },
    };
  }
}

export function createLinter(
  fsMap: Map<string, string>,
  view,
  config: GratsConfig,
) {
  return linter((codeMirrorView) => {
    const text = codeMirrorView.viewState.state.doc.toString();

    const result = buildSchemaResultWithFsMap(fsMap, text, config);

    store.dispatch({ type: "NEW_DOCUMENT_TEXT", value: text });

    if (result.kind === "ERROR") {
      const errorText = result.err.formatDiagnosticsWithContext();
      const output = `# ERROR MESSAGE\n# =============\n\n${commentLines(
        errorText,
      )}`;
      store.dispatch({
        type: "GRATS_EMITTED_NEW_RESULT",
        graphql: output,
        typescript: output,
      });

      return result.err._diagnostics
        .filter((diagnostic) => {
          if (diagnostic.file == null) {
            return false;
          }
          return diagnostic.file.fileName === "index.ts";
        })
        .map((diagnostic) => {
          const actions = [];
          if (diagnostic.fix) {
            const action = gratsFixToCodeMirrorAction(diagnostic.fix);
            actions.push(action);
          }
          return {
            from: diagnostic.start,
            to: diagnostic.start + diagnostic.length,
            severity: "error",
            message: diagnostic.messageText,
            actions,
          };
        });
    }

    const codegenOutput = computeCodegenOutput(result.value.schema, config);
    const output = computeOutput(result.value.doc, view);

    store.dispatch({
      type: "GRATS_EMITTED_NEW_RESULT",
      graphql: output,
      typescript: codegenOutput,
    });

    return [];
  });
}

function computeOutput(
  doc: DocumentNode,
  view: { showGratsDirectives: boolean },
): string {
  if (!view.showGratsDirectives) {
    return printSDLWithoutMetadata(doc);
  }
  return print(doc);
}

function computeCodegenOutput(
  schema: GraphQLSchema,
  config: GratsConfig,
): string {
  return codegen(schema, config, "./schema.ts");
}

function commentLines(text: string): string {
  return text
    .split("\n")
    .map((line) => `# ${line}`)
    .join("\n");
}

function gratsFixToCodeMirrorAction(fix) {
  const changes = [];
  for (const tsChange of fix.changes) {
    for (const textChange of tsChange.textChanges) {
      changes.push({
        from: textChange.span.start,
        to: textChange.span.start + textChange.span.length,
        insert: textChange.newText,
      });
    }
  }
  if (changes.length === 0) {
    return null;
  }
  return {
    name: fix.description,
    apply: (view) => {
      view.dispatch({ changes });
    },
  };
}
