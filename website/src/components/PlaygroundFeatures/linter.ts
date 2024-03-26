import { createSystem, createVirtualCompilerHost } from "@typescript/vfs";
import * as ts from "typescript";
import { buildSchemaAndDocResultWithHost } from "grats/src/lib";
import { codegen } from "grats/src/codegen";
import { ReportableDiagnostics } from "grats/src/utils/DiagnosticError";
import { printSDLWithoutMetadata } from "grats/src/printSchema";
import { linter } from "@codemirror/lint";
import { DocumentNode, GraphQLSchema, print } from "graphql";
import GRATS_TYPE_DECLARATIONS from "!!raw-loader!grats/src/Types.ts";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";

import store from "./store";

const GRATS_PATH = "node_modules/grats/src/index.ts";

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

function buildSchemaResultWithFsMap(fsMap, text: string, config) {
  fsMap.set("index.ts", text);
  fsMap.set(GRATS_PATH, GRATS_TYPE_DECLARATIONS);
  // TODO: Don't recreate the system each time!
  const system = createSystem(fsMap);

  const compilerOpts = {
    allowJs: true,
    baseUrl: "./",
    paths: { grats: [GRATS_PATH] },
    // TODO: Which other files should be included here?
    // For some reason `[...fsMap.keys()]` doesn't work.
    lib: ["/lib.es2021.full.d.ts", "/lib.es2018.promise.d.ts"],
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
    return {
      kind: "ERROR",
      err: {
        formatDiagnosticsWithContext: () => message,
        _diagnostics: [] as ReportableDiagnostics[],
      },
    };
  }
}

export function createLinter(fsMap, view, config) {
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

      return result.err._diagnostics.map((diagnostic) => {
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

    const codegenOutput = computeCodegenOutput(result.value.schema);
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

function computeCodegenOutput(schema: GraphQLSchema): string {
  return codegen(schema, "./schema.ts");
}

function commentLines(text: string): string {
  return text
    .split("\n")
    .map((line) => `# ${line}`)
    .join("\n");
}

function gratsFixToCodeMirrorAction(fix) {
  const change = fix.changes[0]?.textChanges[0];
  if (change == null) {
    return null;
  }
  return {
    name: fix.description,
    apply: (view) => {
      view.dispatch({
        changes: [
          {
            from: change.span.start,
            to: change.span.start + change.span.length,
            insert: change.newText,
          },
        ],
      });
    },
  };
}
