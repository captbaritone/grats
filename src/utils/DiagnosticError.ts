import { GraphQLError } from "graphql";
import { Location } from "./Location";
import * as fs from "fs";
import * as path from "path";

export class AnnotatedLocation {
  loc: Location;
  annotation: string;

  constructor(loc: Location, annotation: string) {
    this.loc = loc;
    this.annotation = annotation;
  }
}

export function annotate(loc: Location, annotation: string) {
  return new AnnotatedLocation(loc, annotation);
}

export default class DiagnosticError extends Error {
  loc: AnnotatedLocation;
  related: AnnotatedLocation[];
  constructor(
    message: string,
    loc: AnnotatedLocation,
    related: AnnotatedLocation[] = [],
  ) {
    super(message);
    this.loc = loc;
    this.related = related;
  }

  // Prints a diagnostic message with code frame to the console.
  reportDiagnostic() {
    console.error(this.asCodeFrame());
  }

  // Formats the diagnostic message with code frame.
  asCodeFrame(): string {
    const source = fs.readFileSync(this.loc.loc.filepath, "utf-8");
    const lines = source.split("\n");

    let frame = _asCodeFrame(lines, this.loc, this.message);
    for (const related of this.related) {
      frame += "\n\n" + _asCodeFrame(lines, related, related.annotation);
    }
    return frame;
  }
}

function _asCodeFrame(
  lines: string[],
  annotated: AnnotatedLocation,
  message: string,
): string {
  const location = annotated.loc;
  const startLine = Math.max(location.start.line - 2, 0);
  const endLine = Math.min(location.end.line, lines.length - 1);

  if (location.start.line !== location.end.line) {
    location.end = {
      line: location.start.line,
      column: location.start.column + 1,
      offset: location.start.offset + 1,
    };
  }

  const gutter = String(endLine).length;
  const defaultGutter = " ".repeat(gutter) + " | ";

  const relativePath = path.relative(process.cwd(), annotated.loc.filepath);

  const fileLocation = `${relativePath}:${location.start.line}:${location.start.column}`;

  const codeFrameLines: string[] = [
    `Error: ${message}:`,
    ` --> ${fileLocation}`,
    "",
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i >= startLine && i <= endLine) {
      let linePrefix = defaultGutter;
      if (i >= location.start.line - 1 && i <= location.end.line - 1) {
        const lineNumber = String(i + 1);
        const lineNumberPadding = " ".repeat(gutter - lineNumber.length);
        linePrefix = `${lineNumberPadding}${lineNumber} | `;
      }
      codeFrameLines.push(`${linePrefix}${line}`);
      // Underline the error
      if (i === location.start.line - 1) {
        const start = location.start.column - 1;
        const end = location.end.column - 1;
        const underline =
          defaultGutter +
          " ".repeat(start) +
          "^".repeat(end - start) +
          " " +
          annotated.annotation;
        codeFrameLines.push(underline);
      }
    }
  }

  codeFrameLines.push("");

  return codeFrameLines.join("\n");
}

// TODO: This is just a hack. Improve handling of multiple locations.
export function graphQlErrorToDiagnostic(error: GraphQLError): DiagnosticError {
  const loc = error.locations![0];
  const position = error.positions![0];
  if (loc == null) {
    throw new Error("Expected error to have a location");
  }
  if (position == null) {
    throw new Error("Expected error to have a position");
  }

  const related: AnnotatedLocation[] = [];
  for (let i = 1; i < error.locations!.length; i++) {
    const loc = error.locations![i];
    const position = error.positions![i];
    if (loc && position) {
      const start = { offset: position, line: loc.line, column: loc.column };
      const end = {
        offset: position + 1,
        line: loc.line,
        column: loc.column + 1,
      };
      related.push(
        new AnnotatedLocation({ start, end, filepath: error.source!.name }, ""),
      );
    }
  }
  const start = { offset: position, line: loc.line, column: loc.column };
  const end = { offset: position + 1, line: loc.line, column: loc.column + 1 };
  return new DiagnosticError(
    error.message,
    new AnnotatedLocation({ start, end, filepath: error.source!.name }, ""),
    related,
  );
}
