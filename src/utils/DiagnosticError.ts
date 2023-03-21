import { GraphQLError } from "graphql";
import * as fs from "fs";
import * as ts from "typescript";

// A madeup error code that we use to fake a TypeScript error code.
// We pick a very random number to avoid collisions with real error messages.
const FAKE_ERROR_CODE = 349389149282;

export default class DiagnosticError extends Error {
  loc: true;
  tsDiagnostic: ts.Diagnostic;
  host: ts.CompilerHost;
  constructor(
    message: string,
    loc: { filepath?: string; start: number; length: number },
    host: ts.CompilerHost,
  ) {
    super(message);
    this.loc = true;
    this.tsDiagnostic = {
      file: loc.filepath
        ? ts.createSourceFile(
            loc.filepath,
            fs.readFileSync(loc.filepath, "utf-8"),
            ts.ScriptTarget.Latest,
          )
        : undefined,
      category: ts.DiagnosticCategory.Error,
      code: FAKE_ERROR_CODE,
      start: loc.start,
      length: loc.length,
      messageText: message,
    };
    if (host == null) {
      throw new Error("Expected host to be defined");
    }
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

  return new DiagnosticError(
    error.message,
    { start: position, length: 1, filepath: error.source?.name },
    host,
  );
}
