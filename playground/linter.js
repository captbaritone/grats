import { createSystem, createVirtualCompilerHost } from "@typescript/vfs";
import * as ts from "typescript";
import { buildSchemaResultWithHost } from "grats";
import { linter } from "@codemirror/lint";
import { printSchema } from "graphql";
import { printSchemaWithDirectives } from "@graphql-tools/utils";

import store from "./store";

function buildSchemaResultWithFsMap(fsMap, text, view, config) {
  fsMap.set("index.ts", text);
  // TODO: Don't recreate the system each time!
  const system = createSystem(fsMap);

  const compilerOpts = { allowJs: true };
  const host = createVirtualCompilerHost(system, compilerOpts, ts);

  const parsedOptions = {
    raw: {
      grats: config,
    },
    options: compilerOpts,
    fileNames: ["index.ts"],
    errors: [],
  };

  let schemaResult;
  try {
    schemaResult = buildSchemaResultWithHost(parsedOptions, host.compilerHost);
  } catch (e) {
    return `# Grats Bug - please report this!\n#\n# Grats threw the following error:\n# ===============================\n\n${e.stack}`;
  }

  if (schemaResult.kind === "ERROR") {
    const errorText = schemaResult.err.formatDiagnosticsWithContext();
    return `# ERROR MESSAGE\n# =============\n\n${errorText}`;
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

export function createLinter(fsMap, view, config) {
  return linter((codeMirrorView) => {
    const text = codeMirrorView.viewState.state.doc.toString();

    const result = buildSchemaResultWithFsMap(fsMap, text, view, config);

    store.dispatch({ type: "NEW_DOCUMENT_TEXT", value: text });
    store.dispatch({ type: "GRATS_EMITTED_NEW_RESULT", value: result });
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
