import { Location } from "./Location";

export type Result<T> =
  | {
      type: "ok";
      value: T;
    }
  | {
      type: "error";
      value: DiagnosticError;
    };

export function catchToResult<T>(fn: () => T): Result<T> {
  try {
    const value = fn();
    return { type: "ok", value };
  } catch (e) {
    if (e instanceof DiagnosticError) {
      return { type: "error", value: e };
    }
    throw e;
  }
}

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
  reportDiagnostic(source: string) {
    console.error(this.asCodeFrame(source, "<dummy file name>"));
  }

  // Formats the diagnostic message with code frame.
  asCodeFrame(source: string, filePath: string): string {
    const lines = source.split("\n");
    const location = this.loc.loc;
    const startLine = Math.max(location.start.line - 2, 0);
    const endLine = Math.min(location.end.line, lines.length - 1);

    if (location.start.line !== location.end.line) {
      console.log(location.start, location.end);
      location.end = location.start;
      // throw new Error("TODO: Multi-line error reporting");
    }

    const gutter = String(endLine).length;
    const defaultGutter = " ".repeat(gutter) + " | ";

    const fileLocation = `${filePath}:${location.start.line}:${location.start.column}`;

    const codeFrameLines: string[] = [
      `Error: ${this.message}:`,
      ` --> ${fileLocation}`,
      "",
    ];

    for (const [i, line] of lines.entries()) {
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
            this.loc.annotation;
          codeFrameLines.push(underline);
        }
      }
    }

    codeFrameLines.push("");

    return codeFrameLines.join("\n");
  }
}
