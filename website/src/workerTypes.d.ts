// Borrowed from https://github.com/microsoft/TypeScript-Website/blob/v2/packages/playground-worker/types.d.ts

import * as ts from "typescript";

type IExtraLibs = Record<string, string>;
export namespace worker {
  export interface IMirrorTextModel {
    readonly version: number;
  }

  export interface IMirrorModel extends IMirrorTextModel {
    readonly uri: any;
    readonly version: number;
    getValue(): string;
  }

  export interface IWorkerContext<H = undefined> {
    /**
     * A proxy to the main thread host object.
     */
    host: H;
    /**
     * Get all available mirror models in this worker.
     */
    getMirrorModels(): IMirrorModel[];
  }
}

export declare class TypeScriptWorker implements ts.LanguageServiceHost {
  private _ctx;
  private _extraLibs;
  private _languageService;
  private _compilerOptions;
  private _inlayHintsOptions?;
  constructor(ctx: worker.IWorkerContext, createData: ICreateData);
  getCompilationSettings(): ts.CompilerOptions;
  getScriptFileNames(): string[];
  private _getModel;
  getScriptVersion(fileName: string): string;
  getScriptText(fileName: string): Promise<string | undefined>;
  _getScriptText(fileName: string): string | undefined;
  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined;
  getScriptKind?(fileName: string): ts.ScriptKind;
  getCurrentDirectory(): string;
  getDefaultLibFileName(options: ts.CompilerOptions): string;
  isDefaultLibFileName(fileName: string): boolean;
  getLibFiles(): Promise<Record<string, string>>;
  private static clearFiles;
  getSyntacticDiagnostics(fileName: string): Promise<ts.Diagnostic[]>;
  getSemanticDiagnostics(fileName: string): Promise<ts.Diagnostic[]>;
  getSuggestionDiagnostics(fileName: string): Promise<ts.Diagnostic[]>;
  getCompilerOptionsDiagnostics(fileName: string): Promise<ts.Diagnostic[]>;
  getCompletionsAtPosition(
    fileName: string,
    position: number,
  ): Promise<ts.CompletionInfo | undefined>;
  getCompletionEntryDetails(
    fileName: string,
    position: number,
    entry: string,
  ): Promise<ts.CompletionEntryDetails | undefined>;
  getSignatureHelpItems(
    fileName: string,
    position: number,
    options: ts.SignatureHelpItemsOptions | undefined,
  ): Promise<ts.SignatureHelpItems | undefined>;
  getQuickInfoAtPosition(
    fileName: string,
    position: number,
  ): Promise<ts.QuickInfo | undefined>;
  getOccurrencesAtPosition(
    fileName: string,
    position: number,
  ): Promise<ReadonlyArray<ts.ReferenceEntry> | undefined>;
  getDefinitionAtPosition(
    fileName: string,
    position: number,
  ): Promise<ReadonlyArray<ts.DefinitionInfo> | undefined>;
  getReferencesAtPosition(
    fileName: string,
    position: number,
  ): Promise<ts.ReferenceEntry[] | undefined>;
  getNavigationBarItems(fileName: string): Promise<ts.NavigationBarItem[]>;
  getFormattingEditsForDocument(
    fileName: string,
    options: ts.FormatCodeOptions,
  ): Promise<ts.TextChange[]>;
  getFormattingEditsForRange(
    fileName: string,
    start: number,
    end: number,
    options: ts.FormatCodeOptions,
  ): Promise<ts.TextChange[]>;
  getFormattingEditsAfterKeystroke(
    fileName: string,
    position: number,
    ch: string,
    options: ts.FormatCodeOptions,
  ): Promise<ts.TextChange[]>;
  findRenameLocations(
    fileName: string,
    position: number,
    findInStrings: boolean,
    findInComments: boolean,
    providePrefixAndSuffixTextForRename: boolean,
  ): Promise<readonly ts.RenameLocation[] | undefined>;
  getRenameInfo(
    fileName: string,
    position: number,
    options: ts.RenameInfoOptions,
  ): Promise<ts.RenameInfo>;
  getEmitOutput(fileName: string): Promise<ts.EmitOutput>;
  getCodeFixesAtPosition(
    fileName: string,
    start: number,
    end: number,
    errorCodes: number[],
    formatOptions: ts.FormatCodeOptions,
  ): Promise<ReadonlyArray<ts.CodeFixAction>>;
  updateExtraLibs(extraLibs: IExtraLibs): Promise<void>;
  provideInlayHints(
    fileName: string,
    start: number,
    end: number,
  ): Promise<readonly ts.InlayHint[]>;
}
export interface ICreateData {
  compilerOptions: ts.CompilerOptions;
  extraLibs: IExtraLibs;
  customWorkerPath?: string;
  inlayHintsOptions?: ts.InlayHintsOptions;
}
/** The shape of the factory */
export interface CustomTSWebWorkerFactory {
  (
    TSWorkerClass: typeof TypeScriptWorker,
    tsc: typeof ts,
    libs: Record<string, string>,
  ): typeof TypeScriptWorker;
}
declare global {
  // var importScripts: (path: string) => void | undefined;
  var customTSWorkerFactory: CustomTSWebWorkerFactory | undefined;
}
export declare function create(
  ctx: worker.IWorkerContext,
  createData: ICreateData,
): TypeScriptWorker;
