import { GraphQLError, Location, Source } from "graphql";
import * as ts from "typescript";
import { Result } from "./Result";

export type FixableDiagnostic = ts.Diagnostic & {
  fix?: ts.CodeFixAction;
};
export type FixableDiagnosticWithLocation = ts.DiagnosticWithLocation & {
  fix?: ts.CodeFixAction;
};

export type DiagnosticResult<T> = Result<T, FixableDiagnosticWithLocation>;
export type DiagnosticsResult<T> = Result<T, FixableDiagnosticWithLocation[]>;

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

// TODO: This is just a hack. Improve handling of multiple locations.
// TODO: Turn this back on
/* eslint-disable @typescript-eslint/no-non-null-assertion */
export function graphQlErrorToDiagnostic(error: GraphQLError): ts.Diagnostic {
  const position = error.positions![0];
  if (position == null) {
    throw new Error("Expected error to have a position");
  }

  // Start with baseline location information
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
          relatedInformation.push(gqlRelated(relatedNode, "Related location"));
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
    source: "Grats",
  };
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

export function rangeErr(
  file: ts.SourceFile,
  commentRange: ts.CommentRange,
  message: string,
  relatedInformation?: ts.DiagnosticRelatedInformation[],
  fix?: ts.CodeFixAction,
): FixableDiagnosticWithLocation {
  const start = commentRange.pos;
  const length = commentRange.end - commentRange.pos;
  return {
    messageText: message,
    file,
    code: FAKE_ERROR_CODE,
    category: ts.DiagnosticCategory.Error,
    start,
    length,
    relatedInformation,
    source: "Grats",
    fix,
  };
}

/**
 * A generic version of the methods on ts.Node that we need
 * to create diagnostics.
 *
 * This interface allows us to create diagnostics from our
 * own classes.
 */
export interface TsLocatableNode {
  getStart(): number;
  getEnd(): number;
  getSourceFile(): ts.SourceFile;
}

export function tsErr(
  node: TsLocatableNode,
  message: string,
  relatedInformation?: ts.DiagnosticRelatedInformation[],
  fix?: ts.CodeFixAction,
): FixableDiagnosticWithLocation {
  const start = node.getStart();
  const length = node.getEnd() - start;
  const sourceFile = node.getSourceFile();
  return {
    messageText: message,
    file: sourceFile,
    code: FAKE_ERROR_CODE,
    category: ts.DiagnosticCategory.Error,
    start,
    length,
    relatedInformation,
    source: "Grats",
    fix,
  };
}

export function tsRelated(
  node: ts.Node,
  message: string,
): ts.DiagnosticRelatedInformation {
  return {
    category: ts.DiagnosticCategory.Message,
    code: 0,
    file: node.getSourceFile(),
    start: node.getStart(),
    length: node.getWidth(),
    messageText: message,
  };
}

export function graphqlSourceToSourceFile(source: Source): ts.SourceFile {
  return ts.createSourceFile(source.name, source.body, ts.ScriptTarget.Latest);
}
