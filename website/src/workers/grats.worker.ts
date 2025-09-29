import type * as ts from "typescript";
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
import prettier from "prettier/standalone";
import parserTypeScript from "prettier/parser-typescript";

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
export class GratsWorker extends TypeScriptWorker {
  _gratsConfig: GratsConfig;
  constructor(ctx, createData) {
    super(ctx, createData);
    this._gratsConfig = {
      schemaHeader: "",
      tsSchemaHeader: "",
      graphqlSchema: "schema.graphql",
      tsSchema: "schema.ts",
      nullableByDefault: true,
      strictSemanticNullability: false,
      reportTypeScriptTypeErrors: false,
      importModuleSpecifierEnding: "",
      EXPERIMENTAL__emitMetadata: false,
      EXPERIMENTAL__emitResolverMap: false,
    };
  }
  getLanguageService(): import("typescript").LanguageService {
    // @ts-ignore
    return this._languageService;
  }

  getGratsConfig(): GratsConfig {
    return this._gratsConfig;
  }

  setGratsConfig(config: Partial<GratsConfig>) {
    this._gratsConfig = {
      ...this._gratsConfig,
      ...config,
    };
  }

  // We need a way to get access to the main text of the monaco editor, which is currently only
  // grabbable via these mirrored models. There's CURRENTLY only one in a Playground.
  getMainText(): string {
    // @ts-ignore
    return this.getMainModel().getValue();
  }
  getMainModel(): import("monaco-editor").editor.ITextModel {
    // @ts-ignore
    return this._ctx.getMirrorModels()[0];
  }

  async format(text: string): Promise<string> {
    return await prettier.format(text, {
      parser: "typescript",
      plugins: [parserTypeScript],
    });
  }

  _gratsResult() {
    const program = this.getLanguageService().getProgram();
    return extractSchemaAndDoc({ raw: { grats: this._gratsConfig } }, program);
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

  async getCodeFixesAtPosition(
    fileName: string,
    start: number,
    end: number,
    errorCodes: number[],
    formatOptions: ts.FormatCodeOptions,
  ): Promise<ReadonlyArray<ts.CodeFixAction>> {
    const fixes = await super.getCodeFixesAtPosition(
      fileName,
      start,
      end,
      errorCodes,
      formatOptions,
    );
    const result = this._gratsResult();
    if (result.kind === "ERROR") {
      const gratsFixes = result.err
        .filter((err) => {
          return (
            // @ts-ignore
            err.file.fileName === fileName &&
            // @ts-ignore
            err.fix != null &&
            err.start === start &&
            err.length === end - start &&
            errorCodes.includes(err.code)
          );
        })
        // @ts-ignore
        .map((err) => err.fix!);

      return [...fixes, ...gratsFixes];
    }
    return fixes;
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
      return "Error";
    }
    const { schema, resolvers } = result.value;
    const gratsConfig = this._gratsConfig;
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
