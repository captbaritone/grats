import { Location, Source } from "graphql";
import * as ts from "typescript";
import { Result } from "./Result.js";

export type FixableDiagnostic = ts.Diagnostic & {
  fix?: ts.CodeFixAction;
};

// GraphQL errors might not have a location, so we have to handle that case
export type DiagnosticsWithoutLocationResult<T> = Result<T, ts.Diagnostic[]>;

export class ReportableDiagnostics {
  _host: ts.FormatDiagnosticsHost;
  _diagnostics: FixableDiagnostic[];

  constructor(
    host: ts.FormatDiagnosticsHost,
    diagnostics: FixableDiagnostic[],
  ) {
    this._host = host;
    this._diagnostics = diagnostics;
  }

  // If you don't have a host, for example if you error while parsing the
  // tsconfig, you can use this method and one will be created for you.
  static fromDiagnostics(diagnostics: ts.Diagnostic[]): ReportableDiagnostics {
    const formatHost: ts.FormatDiagnosticsHost = {
      getCanonicalFileName: (path) => path,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => ts.sys.newLine,
    };
    return new ReportableDiagnostics(formatHost, diagnostics);
  }

  formatDiagnosticsWithColorAndContext(): string {
    const formatted = ts.formatDiagnosticsWithColorAndContext(
      this._diagnostics,
      this._host,
    );
    // TypeScript requires having an error code, but we are not a real TS error,
    // so we don't have an error code. This little hack here is a sin, but it
    // lets us leverage all of TypeScript's error reporting logic.
    return formatted.replace(new RegExp(` TS${FAKE_ERROR_CODE}: `, "g"), ": ");
  }

  formatDiagnosticsWithContext(): string {
    return stripColor(this.formatDiagnosticsWithColorAndContext());
  }
}

// A made-up error code that we use to fake a TypeScript error code.
// We pick a very random number to avoid collisions with real error messages.
export const FAKE_ERROR_CODE = 1038;

function stripColor(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, "");
}

export function locationlessErr(message: string): ts.Diagnostic {
  return {
    messageText: message,
    file: undefined,
    code: FAKE_ERROR_CODE,
    category: ts.DiagnosticCategory.Error,
    start: undefined,
    length: undefined,
    source: "Grats",
  };
}

export function gqlErr(
  item: { loc?: Location },
  message: string,
  relatedInformation?: ts.DiagnosticRelatedInformation[],
): ts.DiagnosticWithLocation {
  if (item.loc == null) {
    throw new Error("Expected item to have loc");
  }
  const loc = item.loc;
  return {
    messageText: message,
    file: graphqlSourceToSourceFile(loc.source),
    code: FAKE_ERROR_CODE,
    category: ts.DiagnosticCategory.Error,
    start: loc.start,
    length: loc.end - loc.start,
    relatedInformation,
    source: "Grats",
  };
}

export function gqlRelated(
  item: { loc?: Location },
  message: string,
): ts.DiagnosticRelatedInformation {
  if (item.loc == null) {
    throw new Error("Expected item to have loc");
  }
  const loc = item.loc;
  return {
    category: ts.DiagnosticCategory.Message,
    code: FAKE_ERROR_CODE,
    messageText: message,
    file: graphqlSourceToSourceFile(loc.source),
    start: loc.start,
    length: loc.end - loc.start,
  };
}

export function diagnosticsMessage(messageText: string): ts.Diagnostic {
  return {
    file: undefined,
    start: undefined,
    length: undefined,
    messageText,
    category: ts.DiagnosticCategory.Message,
    source: "Grats",
    code: FAKE_ERROR_CODE,
  };
}

export function graphqlSourceToSourceFile(source: Source): ts.SourceFile {
  return ts.createSourceFile(source.name, source.body, ts.ScriptTarget.Latest);
}
