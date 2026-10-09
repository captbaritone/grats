import type * as ts from "typescript";
// See https://github.com/microsoft/monaco-editor/pull/3488
import {
  // @ts-ignore
  initialize,
  // @ts-ignore
  TypeScriptWorker,
  // @ts-ignore
  ts as typescriptServices,
  // @ts-ignore
} from "./ts.worker.mjs";
import prettier from "prettier/standalone";
import parserTypeScript from "prettier/parser-typescript";
import type { monaco } from "react-monaco-editor";
import type { GratsConfig } from "../components/configSchema";
import type { CompileResult, Diagnostic, FileLocation } from "../wasm/grats";
import type { ExecutableModulesResult } from "../components/MonacoPlayground/executionProtocol";
import { loadGrats, PACKAGE_FILES } from "../wasm/loadGrats";

// The docblock tags offered as completions. See `documentationForTag`.
const TAGS = [
  "gqlType",
  "gqlField",
  "gqlScalar",
  "gqlInterface",
  "gqlEnum",
  "gqlUnion",
  "gqlInput",
  "gqlDirective",
  "gqlAnnotate",
  "gqlQueryField",
  "gqlMutationField",
  "gqlSubscriptionField",
  "killsParentOnException",
  "oneOf",
] as const;

type TagName = (typeof TAGS)[number];

// The path Grats is given the editor's text at.
const MAIN_FILE = "/index.ts";

// TypeScript requires diagnostics to have a code. Grats' have none, so we use
// a made up one, unlikely to collide with TypeScript's.
const GRATS_ERROR_CODE = 349389149282;

// https://github.com/microsoft/monaco-editor/blob/main/src/language/typescript/tsWorker.ts
// https://github.com/microsoft/TypeScript-Website/blob/c2b25d220465dac34dd2da41a2a44cb30c6f42e4/packages/playground-worker/index.ts
export class GratsWorker extends TypeScriptWorker {
  _gratsConfig: GratsConfig;
  constructor(ctx, createData) {
    super(ctx, createData);
    this._gratsConfig = {
      schemaHeader: null,
      tsSchemaHeader: null,
      tsClientEnumsHeader: null,
      graphqlSchema: "schema.graphql",
      tsSchema: "schema.ts",
      tsClientEnums: null,
      nullableByDefault: true,
      strictSemanticNullability: false,
      importModuleSpecifierEnding: "",
      EXPERIMENTAL__emitMetadata: false,
      EXPERIMENTAL__emitResolverMap: false,
    };
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

  // The name TypeScript knows the editor's text by.
  getMainFileName(): string {
    return this.getMainModel().uri.toString();
  }

  async format(text: string): Promise<string> {
    return await prettier.format(text, {
      parser: "typescript",
      plugins: [parserTypeScript],
    });
  }

  async _gratsResult(
    configOverrides?: Partial<GratsConfig>,
  ): Promise<CompileResult> {
    const grats = await loadGrats();
    return grats.compile({
      files: { ...PACKAGE_FILES, [MAIN_FILE]: this.getMainText() },
      rootNames: [MAIN_FILE],
      config: { ...this._gratsConfig, ...configOverrides },
    });
  }

  // Grats' diagnostics in the editor's text.
  async _mainFileDiagnostics(fileName: string): Promise<Diagnostic[]> {
    if (fileName !== this.getMainFileName()) {
      return [];
    }
    const result = await this._gratsResult();
    if (result.kind === "OK") {
      return [];
    }
    return result.err.filter((err) => err.location?.fileName === MAIN_FILE);
  }

  async getSemanticDiagnostics(fileName: string) {
    const diagnostics = await super.getSemanticDiagnostics(fileName);
    const gratsDiagnostics = await this._mainFileDiagnostics(fileName);
    return [...diagnostics, ...gratsDiagnostics.map((err) => this._toTs(err))];
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
    const gratsFixes = (await this._mainFileDiagnostics(fileName)).flatMap(
      ({ location, fix }) => {
        // There is any overlap between the error and the requested range
        if (
          fix == null ||
          location == null ||
          location.start >= end ||
          location.start + location.length <= start
        ) {
          return [];
        }
        const changes = fix.changes.map((change) => ({
          ...change,
          fileName: this._toTsFileName(change.fileName),
        }));
        return [{ ...fix, changes }];
      },
    );
    return [...fixes, ...gratsFixes];
  }

  _toTsFileName(fileName: string): string {
    return fileName === MAIN_FILE ? this.getMainFileName() : fileName;
  }

  // Like a `ts.Diagnostic`, as Monaco's TypeScript worker sends them.
  _toTs(err: Diagnostic) {
    const location = (location: FileLocation) => ({
      file: { fileName: this._toTsFileName(location.fileName) },
      start: location.start,
      length: location.length,
    });
    return {
      ...location(err.location!),
      messageText: err.message,
      code: GRATS_ERROR_CODE,
      category: 1, // ts.DiagnosticCategory.Error
      relatedInformation: err.relatedInformation.map((related) => ({
        ...location(related.location),
        messageText: related.message,
        code: GRATS_ERROR_CODE,
        category: 3, // ts.DiagnosticCategory.Message
      })),
    };
  }

  formatErrors(errors: Diagnostic[], commentPrefix: string): string {
    return commentLines(
      errors.map((err) => err.formatted).join("\n"),
      commentPrefix,
    );
  }

  async getGraphQLSchema(): Promise<string> {
    const result = await this._gratsResult();
    if (result.kind === "ERROR") {
      return this.formatErrors(result.err, "# ");
    }
    return result.value.outputs.graphqlSchema.trim();
  }

  async getResolverSignatures(): Promise<string> {
    const result = await this._gratsResult({
      EXPERIMENTAL__emitMetadata: true,
    });
    if (result.kind === "ERROR") {
      return this.formatErrors(result.err, "// ");
    }
    return result.value.outputs.metadata!;
  }

  async getTsSchema(): Promise<string> {
    const result = await this._gratsResult();
    if (result.kind === "ERROR") {
      return this.formatErrors(result.err, "// ");
    }
    return result.value.outputs.tsSchema.trim();
  }

  async getTsClientEnums(): Promise<string> {
    // Only enable tsClientEnums when generating the enums file
    const result = await this._gratsResult({ tsClientEnums: "enums.ts" });
    if (result.kind === "ERROR") {
      return this.formatErrors(result.err, "// ");
    }
    return result.value.outputs.tsClientEnums!.trim();
  }

  async getResolverMap(): Promise<string> {
    const result = await this._gratsResult({
      EXPERIMENTAL__emitResolverMap: true,
      tsSchema: "resolvers.ts",
    });
    if (result.kind === "ERROR") {
      return this.formatErrors(result.err, "// ");
    }
    return result.value.outputs.tsSchema.trim();
  }

  // The editor's code and the executable schema Grats generates for it,
  // compiled to CommonJS for the playground's service worker to run.
  async getExecutableModules(): Promise<ExecutableModulesResult> {
    // Pin the options which affect how the schema imports the editor's code.
    const result = await this._gratsResult({
      tsSchema: "schema.ts",
      importModuleSpecifierEnding: "",
      EXPERIMENTAL__emitResolverMap: false,
    });
    if (result.kind === "ERROR") {
      return {
        kind: "ERROR",
        message: result.err.map((err) => err.formatted).join("\n"),
      };
    }
    // Monaco's wrapper exposes the full TypeScript API as `typescript`.
    const ts = typescriptServices.typescript as typeof import("typescript");
    const transpile = (text: string, fileName: string) =>
      ts.transpileModule(text, {
        fileName,
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }).outputText;
    return {
      kind: "OK",
      modules: {
        index: transpile(this.getMainText(), "index.ts"),
        schema: transpile(result.value.outputs.tsSchema, "schema.ts"),
      },
    };
  }

  async getTagsAtPosition(
    position: monaco.IPosition,
  ): Promise<monaco.languages.CompletionList> {
    const suggestions = TAGS.map((name) => {
      return {
        label: `@${name}`,
        kind: 16, // Enum member, least worst choice
        // Unclear why `documentation` doesn't work here.
        detail: documentationForTag(name),
        insertText: name,
        filterText: name, // Needed because we've changed `label` to include `@`
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
      };
    });
    return { suggestions };
  }
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
