import { Result } from "./Result.js";

/**
 * A diagnostic reported by the Rust port of Grats, which formats it like
 * TypeScript's `formatDiagnosticsWithColorAndContext`. See
 * `ReportableDiagnostic` in
 * `grats-rs/crates/grats/src/utils/format_diagnostics.rs`.
 */
export type GratsDiagnostic = {
  formatted: string;
  fix?: CodeFixAction;
};

/** Like a `ts.CodeFixAction`. Offsets are UTF-16. */
export type CodeFixAction = {
  fixName: string;
  description: string;
  changes: FileTextChanges[];
};

export type FileTextChanges = {
  fileName: string;
  textChanges: TextChange[];
};

export type TextChange = {
  span: { start: number; length: number };
  newText: string;
};

// GraphQL errors might not have a location, so we have to handle that case
export type DiagnosticsWithoutLocationResult<T> = Result<T, GratsDiagnostic[]>;

export class ReportableDiagnostics {
  _diagnostics: GratsDiagnostic[];

  constructor(diagnostics: GratsDiagnostic[]) {
    this._diagnostics = diagnostics;
  }

  static fromDiagnostics(
    diagnostics: GratsDiagnostic[],
  ): ReportableDiagnostics {
    return new ReportableDiagnostics(diagnostics);
  }

  formatDiagnosticsWithColorAndContext(): string {
    return this._diagnostics.map((d) => d.formatted).join("");
  }

  formatDiagnosticsWithContext(): string {
    return stripColor(this.formatDiagnosticsWithColorAndContext());
  }
}

function stripColor(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, "");
}
