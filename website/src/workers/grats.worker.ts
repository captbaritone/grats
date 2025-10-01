import type * as ts from "typescript";
import { printExecutableSchema } from "../../../src/printSchema";
import { TagName, TAGS } from "../../../src/Extractor";
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
import { ReportableDiagnostics } from "../../../src/utils/DiagnosticError";
import type { monaco } from "react-monaco-editor";

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
            // There is any overlap between the error and the requested range
            err.start != null &&
            err.length != null &&
            err.start < end &&
            err.start + err.length > start
          );
        })
        // @ts-ignore
        .map((err) => err.fix!);

      return [...fixes, ...gratsFixes];
    }
    return fixes;
  }

  formatErrors(errors: ts.Diagnostic[], commentPrefix: string): string {
    const host: ts.FormatDiagnosticsHost = {
      getCurrentDirectory: () => "/",
      getNewLine: () => "\n",
      getCanonicalFileName: function (fileName: string): string {
        return fileName;
      },
    };
    const reportable = new ReportableDiagnostics(host, errors);
    return commentLines(
      reportable.formatDiagnosticsWithContext(),
      commentPrefix,
    );
  }

  async getGraphQLSchema(): Promise<string> {
    const result = this._gratsResult();
    if (result.kind === "ERROR") {
      return this.formatErrors(result.err, "# ");
    }
    return printSDLWithoutMetadata(result.value.doc);
  }

  async getResolverSignatures(): Promise<string> {
    const result = this._gratsResult();
    if (result.kind === "ERROR") {
      return this.formatErrors(result.err, "// ");
    }
    const { resolvers } = result.value;
    return JSON.stringify(resolvers, null, 2);
  }

  async getTsSchema(): Promise<string> {
    const result = this._gratsResult();
    if (result.kind === "ERROR") {
      return this.formatErrors(result.err, "// ");
    }
    const { schema, resolvers } = result.value;
    const gratsConfig = this._gratsConfig;
    const dest = "schema.ts";
    return printExecutableSchema(schema, resolvers, gratsConfig, dest).trim();
  }

  async getTags(): Promise<monaco.languages.CompletionItem[]> {
    function documentationForTag(name: TagName): string {
      switch (name) {
        case "gqlType":
          return "Defines a GraphQL Object.";
        case "gqlInterface":
          return "Defines a GraphQL Interface.";
        case "gqlUnion":
          return "Defines a GraphQL Union.";
        case "gqlEnum":
          return "Defines a GraphQL Enum.";
        case "gqlInput":
          return "Defines a GraphQL Input Object.";
        case "gqlField":
          return "Defines a field on a GraphQL Object, Interface, or Input Object.";
        case "gqlQueryField":
          return "Defines a top-level Query field.";
        case "gqlMutationField":
          return "Defines a top-level Mutation field.";
        case "gqlSubscriptionField":
          return "Defines a top-level Subscription field.";
        case "gqlScalar":
          return "Defines a custom GraphQL Scalar.";
        case "gqlDirective":
          return "Defines a custom GraphQL Directive.";
        case "gqlAnnotate":
          return "Attaches a directive to a GraphQL schema element.";
        case "oneOf":
          return "Marks an input object with `@oneOf`.";
        case "killsParentOnException":
          return "Indicates that a field should be typed as non-nullable and if an error is encountered, bubble that error up to the parent.";
        default: {
          // Exhaustive check
          const _exhaustiveCheck: never = name;
          throw new Error(`Unknown tag name: ${name}`);
        }
      }
    }
    return TAGS.map((name) => {
      return {
        label: `@${name}`,
        kind: 16, // Enum member, least worst choice
        // Unclear why `documentation` doesn't work here.
        detail: documentationForTag(name),
        insertText: name,
        filterText: name, // Needed because we've changed `label` to include `@`
      } as any;
    });
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

function commentLines(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => `${prefix} ${line}`)
    .join("\n");
}
