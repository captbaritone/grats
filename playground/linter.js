import { createSystem, createVirtualCompilerHost } from "@typescript/vfs";
import * as ts from "typescript";
import { buildSchemaResultWithHost } from "grats";
import { linter } from "@codemirror/lint";
import { printSchema } from "graphql";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import * as fs from "fs";

import store from "./store";

const GRATS_PATH = "node_modules/grats/src/index.ts";
const GRATS_TYPE_DECLARATIONS = fs.readFileSync(
  "node_modules/grats/src/Types.ts",
  "utf8"
);

function buildSchemaResultWithFsMap(fsMap, text, config) {
  fsMap.set("index.ts", text);
  fsMap.set(GRATS_PATH, GRATS_TYPE_DECLARATIONS);
  // TODO: Don't recreate the system each time!
  const system = createSystem(fsMap);

  const compilerOpts = {
    allowJs: true,
    baseUrl: "./",
    paths: { grats: [GRATS_PATH] },
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

  return buildSchemaResultWithHost(parsedOptions, host.compilerHost);
}

export function createLinter(fsMap, view, config) {
  return linter((codeMirrorView) => {
    const text = codeMirrorView.viewState.state.doc.toString();

    const result = buildSchemaResultWithFsMap(fsMap, text, config);

    store.dispatch({ type: "NEW_DOCUMENT_TEXT", value: text });

    const output = computeOutput(result, view);

    store.dispatch({ type: "GRATS_EMITTED_NEW_RESULT", value: output });
    let diagnostics = [];

    if (result.kind === "ERROR") {
      for (const diagnostic of result.err._diagnostics) {
        diagnostics.push({
          from: diagnostic.start,
          to: diagnostic.start + diagnostic.length,
          severity: "error",
          message: diagnostic.messageText,
          actions: [],
        });
      }
    }

    return diagnostics;
  });
}

function computeOutput(schemaResult, view) {
  if (schemaResult.kind === "ERROR") {
    const errorText = schemaResult.err.formatDiagnosticsWithContext();
    return `# ERROR MESSAGE\n# =============\n\n${commentLines(errorText)}`;
  }

  const schema = schemaResult.value;
  if (!view.showGratsDirectives) {
    // HACK!
    schema._directives = schema._directives.filter(
      (directive) =>
        directive.name !== "exported" && directive.name !== "methodName"
    );
    return printSchema(schema);
  }
  return printSchemaWithDirectives(schema, { assumeValid: true });
}

function commentLines(text) {
  return text
    .split("\n")
    .map((line) => `# ${line}`)
    .join("\n");
}
