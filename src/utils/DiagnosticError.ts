import { GraphQLError, Location, Source } from "graphql";
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
  _host: ts.FormatDiagnosticsHost;
  _diagnostics: ts.Diagnostic[];

  constructor(host: ts.FormatDiagnosticsHost, diagnostics: ts.Diagnostic[]) {
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

  // Start with baseline location infromation
  let start = position;
  let length = 1;
  let relatedInformation: ts.DiagnosticRelatedInformation[] | undefined;

  // Nodes have actual ranges (not just a single position), so we we have one
  // (or more!) use that instead.
  if (error.nodes != null && error.nodes.length > 0) {
    const [node, ...rest] = error.nodes;
    if (node.loc != null) {
      start = node.loc.start;
      length = node.loc.end - node.loc.start;
      if (rest.length > 0) {
        relatedInformation = [];
        for (const relatedNode of rest) {
          if (relatedNode.loc == null) {
            continue;
          }
          relatedInformation.push({
            category: ts.DiagnosticCategory.Message,
            code: FAKE_ERROR_CODE,
            messageText: "Related location",
            file: graphqlSourceToSourceFile(relatedNode.loc.source),
            start: relatedNode.loc.start,
            length: relatedNode.loc.end - relatedNode.loc.start,
          });
        }
      }
    }
  }

  let sourceFile: ts.SourceFile | undefined;
  if (error.source != null) {
    sourceFile = graphqlSourceToSourceFile(error.source);
  }

  return {
    messageText: error.message,
    file: sourceFile,
    code: FAKE_ERROR_CODE,
    category: ts.DiagnosticCategory.Error,
    start,
    length,
    relatedInformation,
  };
}

export function diagnosticAtGraphQLLocation(
  message: string,
  loc: Location,
): ts.Diagnostic {
  return {
    messageText: message,
    file: graphqlSourceToSourceFile(loc.source),
    code: FAKE_ERROR_CODE,
    category: ts.DiagnosticCategory.Error,
    start: loc.start,
    length: loc.end - loc.start,
  };
}

export function graphqlSourceToSourceFile(source: Source): ts.SourceFile {
  return ts.createSourceFile(source.name, source.body, ts.ScriptTarget.Latest);
}
