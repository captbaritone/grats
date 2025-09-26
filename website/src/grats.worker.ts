// See https://github.com/microsoft/monaco-editor/pull/3488
import {
  initialize,
  // ts,
  TypeScriptWorker,
} from "monaco-editor/esm/vs/language/typescript/ts.worker.js";
// } from "https://playgroundcdn.typescriptlang.org/cdn/5.8.3/monaco/min/vs/language/typescript/tsWorker.js";
import { extractSchemaAndDoc } from "grats";

// Could we get a more up-to-date one here?

// https://playgroundcdn.typescriptlang.org/cdn/5.8.3/monaco/min/vs/language/typescript/tsWorker.js

// https://github.com/microsoft/monaco-editor/blob/main/src/language/typescript/tsWorker.ts
// https://github.com/microsoft/TypeScript-Website/blob/c2b25d220465dac34dd2da41a2a44cb30c6f42e4/packages/playground-worker/index.ts
class GratsWorker extends TypeScriptWorker {
  getLanguageService(): import("typescript").LanguageService {
    // @ts-ignore
    return this._languageService;
  }

  async getSemanticDiagnostics(fileName: string) {
    const diagnostics = await super.getSemanticDiagnostics(fileName);
    const program = this.getLanguageService().getProgram();
    const result = extractSchemaAndDoc({ raw: { grats: {} } }, program);
    if (result.kind === "ERROR") {
      const gratsDiagnostics = result.err
        .filter((err) => err.file?.fileName === fileName)
        .map((err) => ({
          ...err,
          file: { fileName: err.file?.fileName },
        }));
      return [...diagnostics, ...gratsDiagnostics];
    }
    return diagnostics;
  }
}

self.onmessage = () => {
  initialize((ctx, createData) => {
    // @ts-expect-error This is missing in the Monaco type definitions.
    return new GratsWorker(ctx, createData);
  });
};
