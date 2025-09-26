// See https://github.com/microsoft/monaco-editor/pull/3488
import {
  // @ts-ignore
  initialize,
  // @ts-ignore
  TypeScriptWorker,
  // @ts-ignore
} from "./ts.worker.mjs";
import { extractSchemaAndDoc } from "grats";

// @ts-ignore
global.process = {
  // Grats depends upon calling path.resolver and path.relative
  // which depend upon process.cwd() being set.
  // Here we supply a fake cwd() function that returns the root
  cwd() {
    return "/";
  },
};

// https://github.com/microsoft/monaco-editor/blob/main/src/language/typescript/tsWorker.ts
// https://github.com/microsoft/TypeScript-Website/blob/c2b25d220465dac34dd2da41a2a44cb30c6f42e4/packages/playground-worker/index.ts
class GratsWorker extends TypeScriptWorker {
  constructor(ctx, createData) {
    super(ctx, createData);
  }
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
        .map((err) => mapDiagnostic(err));
      return [...diagnostics, ...gratsDiagnostics];
    }
    return diagnostics;
  }
}

function mapDiagnostic(diagnostic) {
  return {
    ...diagnostic,
    file: { fileName: diagnostic.file?.fileName },
    relatedInformation: diagnostic.relatedInformation?.map(mapDiagnostic),
  };
}

self.onmessage = () => {
  // console.log("GratsWorker onmessage", { arguments });
  // @ts-ignore
  // prevOnmessage.apply(self, arguments);
  initialize((ctx, createData) => {
    return new GratsWorker(ctx, createData);
  });
};
