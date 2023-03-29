import { createSystem, createVirtualCompilerHost } from "@typescript/vfs";
import * as ts from "typescript";
import { buildSchemaResultWithHost } from "grats";
import { printSchemaWithDirectives } from "@graphql-tools/utils";
import { linter } from "@codemirror/lint";
import lzstring from "lz-string";

function updateUrlHash(state) {
  const hash = lzstring.compressToEncodedURIComponent(JSON.stringify(state));
  window.location.hash = hash;
}

function buildSchemaResultWithFsMap(state, fsMap) {
  fsMap.set("index.ts", state.doc);
  const system = createSystem(fsMap);

  const compilerOpts = { allowJs: true };
  const host = createVirtualCompilerHost(system, compilerOpts, ts);

  const parsedOptions = {
    raw: {
      grats: {},
    },
    options: compilerOpts,
    files: ["index.ts"],
    errors: [],
  };

  return buildSchemaResultWithHost(parsedOptions, host.compilerHost);
}

export function createLinter(outputView, fsMap) {
  return linter((view) => {
    const nullableByDefault =
      document.getElementById("default-nullable").checked;

    // TODO: Don't recreate the system each time!
    const text = view.viewState.state.doc.toString();
    const state = {
      doc: text,
      config: {
        nullableByDefault,
      },
      VERSION: 1,
    };
    updateUrlHash(state);

    const result = buildSchemaResultWithFsMap(state, fsMap);
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

      const errorText = result.err.formatDiagnosticsWithContext();
      outputView.dispatch({
        changes: {
          from: 0,
          to: outputView.state.doc.length,
          insert: `# ERROR MESSAGE\n# =============\n\n${errorText}`,
        },
      });
    } else {
      const sdl = printSchemaWithDirectives(result.value);
      outputView.dispatch({
        changes: {
          from: 0,
          to: outputView.state.doc.length,
          insert: sdl,
        },
      });
    }

    return diagnostics;
  });
}
