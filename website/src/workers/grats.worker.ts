import { printExecutableSchema } from "../../../src/printSchema";
// See https://github.com/microsoft/monaco-editor/pull/3488
import {
  // @ts-ignore
  initialize,
  // @ts-ignore
  TypeScriptWorker,
  // @ts-ignore
} from "./ts.worker.mjs";
import {
  extractSchemaAndDoc,
  GratsConfig,
  printSDLWithoutMetadata,
} from "grats";

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

  _gratsConfig(): GratsConfig {
    // TODO!
    return {
      schemaHeader: "",
      tsSchemaHeader: "",
      /*
      graphqlSchema: string;
    tsSchema: string;
    nullableByDefault: boolean;
    strictSemanticNullability: boolean;
    reportTypeScriptTypeErrors: boolean;
    schemaHeader: string | null;
    tsSchemaHeader: string | null;
    importModuleSpecifierEnding: string;
    EXPERIMENTAL__emitMetadata: boolean;
    EXPERIMENTAL__emitResolverMap: boolean;
    */
    };
  }

  _gratsResult() {
    const program = this.getLanguageService().getProgram();
    return extractSchemaAndDoc(
      { raw: { grats: this._gratsConfig() } },
      program,
    );
  }

  async getSemanticDiagnostics(fileName: string) {
    const diagnostics = await super.getSemanticDiagnostics(fileName);
    const result = this._gratsResult();
    if (result.kind === "ERROR") {
      const gratsDiagnostics = result.err
        .filter((err) => err.file?.fileName === fileName)
        .map((err) => mapDiagnostic(err));
      return [...diagnostics, ...gratsDiagnostics];
    }
    return diagnostics;
  }

  async getGraphQLSchema(): Promise<string> {
    const result = this._gratsResult();
    if (result.kind === "ERROR") {
      return "Error";
    }
    return printSDLWithoutMetadata(result.value.doc);
  }

  async getResolverSignatures(): Promise<string> {
    const result = this._gratsResult();
    if (result.kind === "ERROR") {
      return "Error";
    }
    const { resolvers } = result.value;
    return JSON.stringify(resolvers, null, 2);
  }

  async getTsSchema(): Promise<string> {
    const result = this._gratsResult();
    if (result.kind === "ERROR") {
      console.log(result.err);
      return "Error";
    }
    const { schema, resolvers } = result.value;
    const gratsConfig = this._gratsConfig();
    const dest = "schema.ts";
    return printExecutableSchema(schema, resolvers, gratsConfig, dest).trim();
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
