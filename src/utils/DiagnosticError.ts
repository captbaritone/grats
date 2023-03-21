import { GraphQLError } from "graphql";
import * as ts from "typescript";

type Ok<T> = { kind: "OK"; value: T };
type Err<E> = { kind: "ERROR"; err: E };
export type Result<T, E> = Ok<T> | Err<E>;
export type DiagnosticResult<T> = Result<T, ts.Diagnostic>;
export type DiagnosticsResult<T> = Result<T, ts.Diagnostic[]>;

export function ok<T>(value: T): Ok<T> {
  return { kind: "OK", value };
}
export function err<E>(err: E): Err<E> {
  return { kind: "ERROR", err };
}

export class ReportableDiagnostics {
  _host: ts.CompilerHost;
  _diagnostics: ts.Diagnostic[];

  constructor(host: ts.CompilerHost, diagnostics: ts.Diagnostic[]) {
    this._host = host;
    this._diagnostics = diagnostics;
  }

  formatDiagnosticsWithColorAndContext(): string {
    const formatted = ts.formatDiagnosticsWithColorAndContext(
      this._diagnostics,
      this._host,
    );
    // TypeScript requires having an error code, but we are not a real TS error,
    // so we don't have an error code. This little hack here is a sin, but it
    // lets us leverage all of TypeScript's error reporting logic.
    return formatted.replace(` TS${FAKE_ERROR_CODE}: `, ": ");
  }

  formatDiagnosticsWithContext(): string {
    return stripColor(this.formatDiagnosticsWithColorAndContext());
  }
}

// A madeup error code that we use to fake a TypeScript error code.
// We pick a very random number to avoid collisions with real error messages.
export const FAKE_ERROR_CODE = 349389149282;

function stripColor(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, "");
}

// TODO: This is just a hack. Improve handling of multiple locations.
// TODO: Turn this back on
/* eslint-disable @typescript-eslint/no-non-null-assertion */
export function graphQlErrorToDiagnostic(error: GraphQLError): ts.Diagnostic {
  const position = error.positions![0];
  if (position == null) {
    throw new Error("Expected error to have a position");
  }

  let sourceFile: ts.SourceFile | undefined;
  if (error.source != null) {
    sourceFile = ts.createSourceFile(
      error.source.name,
      error.source.body,
      ts.ScriptTarget.Latest,
    );
  }

  return {
    messageText: error.message,
    file: sourceFile,
    code: FAKE_ERROR_CODE,
    category: ts.DiagnosticCategory.Error,
    start: position,
    // FIXME: Improve ranges
    length: 1,
  };
}
