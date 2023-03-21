import { GraphQLError } from "graphql";
import * as ts from "typescript";

type Ok<T> = { kind: "OK"; value: T };
type Err<E> = { kind: "ERROR"; err: E };
type Result<T, E> = Ok<T> | Err<E>;
export type DiagnosticResult<T> = Result<T, DiagnosticError>;
export type DiagnosticsResult<T> = Result<T, DiagnosticError[]>;

export function ok<T>(value: T): Ok<T> {
  return { kind: "OK", value };
}
export function err<E>(err: E): Err<E> {
  return { kind: "ERROR", err };
}

// A madeup error code that we use to fake a TypeScript error code.
// We pick a very random number to avoid collisions with real error messages.
const FAKE_ERROR_CODE = 349389149282;

export default class DiagnosticError {
  tsDiagnostic: ts.Diagnostic;
  host: ts.CompilerHost;
  constructor(
    message: string,
    loc: { filepath?: ts.SourceFile; start: number; length: number },
    host: ts.CompilerHost,
  ) {
    this.tsDiagnostic = {
      file: loc.filepath,
      category: ts.DiagnosticCategory.Error,
      code: FAKE_ERROR_CODE,
      start: loc.start,
      length: loc.length,
      messageText: message,
    };
    this.host = host;
  }

  formatWithColorAndContext(): string {
    const formatted = ts.formatDiagnosticsWithColorAndContext(
      [this.tsDiagnostic],
      this.host,
    );
    // TypeScript requires having an error code, but we are not a real TS error,
    // so we don't have an error code. This little hack here is a sin, but it
    // lets us leverage all of TypeScript's error reporting logic.
    return formatted.replace(` TS${FAKE_ERROR_CODE}: `, ": ");
  }

  formatWithContext(): string {
    return stripColor(this.formatWithColorAndContext());
  }
}

function stripColor(str: string): string {
  return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, "");
}

// TODO: This is just a hack. Improve handling of multiple locations.
// TODO: Turn this back on
/* eslint-disable @typescript-eslint/no-non-null-assertion */
export function graphQlErrorToDiagnostic(
  error: GraphQLError,
  host: ts.CompilerHost,
): DiagnosticError {
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

  return new DiagnosticError(
    error.message,
    // FIXME: Improve ranges
    { start: position, length: 1, filepath: sourceFile },
    host,
  );
}
