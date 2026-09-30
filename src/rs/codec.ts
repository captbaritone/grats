import { Location, Source, Token, TokenKind } from "graphql";
import * as ts from "typescript";
import type { GratsConfig } from "../gratsConfig.js";
import type { RustProgramOptions } from "./host.js";
import {
  FixableDiagnostic,
  gqlErr,
  gqlRelated,
  locationlessErr,
} from "../utils/DiagnosticError.js";

/**
 * Encodes values passed between TypeScript and the Rust port of Grats
 * (compiled to wasm) as JSON strings.
 *
 * Most of what crosses is already plain data. The exception is graphql-js
 * `Location`, which references its entire `Source` text. Rust encodes
 * locations as offsets into a source in a `SourceTable`, which stays on the
 * TypeScript side.
 */

export type EncodedLocation = {
  /** Index into the `SourceTable` used to encode the location. */
  source: number;
  start: number;
  end: number;
};

/**
 * The sources referenced by encoded locations. Rust asks the table for the
 * id of each source (see `host` in `src/rs/host.ts`), so decode its output
 * with the table which answered it.
 *
 * Sources are identified by name and text rather than by name alone, since
 * GraphQL parsed from docblocks (e.g. `@gqlAnnotate`) gets its own
 * "GraphQL request" source for each docblock tag.
 */
export class SourceTable {
  private _sources: Array<{ source: Source; lines: ts.SourceFileLike }> = [];
  private _idsByName: Map<string, number[]> = new Map();

  /**
   * Rebuilds a location with the same shape as those created during
   * extraction by `loc()` in `graphql_constructor.rs`: its tokens carry the
   * line and character of its offsets, which `grats locate` reports.
   */
  decodeLocation(encoded: EncodedLocation): Location {
    const entry = this._sources[encoded.source];
    if (entry == null) {
      throw new Error(`Unknown source id ${encoded.source}.`);
    }
    const token = (pos: number) => {
      const { line, character } =
        entry.lines.getLineAndCharacterOfPosition(pos);
      return new Token(TokenKind.SOF, pos, pos, line, character, undefined);
    };
    return new Location(token(encoded.start), token(encoded.end), entry.source);
  }

  /** The source with id `id`. */
  source(id: number): Source {
    const entry = this._sources[id];
    if (entry == null) {
      throw new Error(`Unknown source id ${id}.`);
    }
    return entry.source;
  }

  /** The id of `source`, which is added to the table if it's not there. */
  sourceId(source: Source): number {
    let ids = this._idsByName.get(source.name);
    if (ids == null) {
      ids = [];
      this._idsByName.set(source.name, ids);
    }
    for (const id of ids) {
      if (this._sources[id].source.body === source.body) {
        return id;
      }
    }
    const id = this._sources.length;
    // TypeScript computes the line map lazily and caches it on the object.
    const lines: ts.SourceFileLike = {
      text: source.body,
      getLineAndCharacterOfPosition(pos) {
        return ts.getLineAndCharacterOfPosition(this, pos);
      },
    };
    this._sources.push({ source, lines });
    ids.push(id);
    return id;
  }
}

/**
 * The input to the `run_pipeline` entry point. See `PipelineRequest` in
 * `grats-rs/crates/grats/src/pipeline.rs`.
 */
export type RustPipelineRequest = {
  config: GratsConfig;
  gratsRoot: string;
  program: RustProgramOptions;
};

/**
 * The input to the `print_outputs` entry point, besides the document. See
 * `OutputRequest` in `grats-rs/crates/grats/src/print_schema.rs`.
 */
export type RustOutputRequest = {
  config: GratsConfig;
  gratsRoot: string;
  graphqlSchema: boolean;
  tsSchema: string | null;
  tsClientEnums: string | null;
  metadata: boolean;
};

/**
 * The input to the `locate` entry point, besides the document. See
 * `LocateRequest` in `grats-rs/crates/grats/src/locate.rs`.
 */
export type RustLocateRequest = {
  entityName: string;
};

/**
 * The requests of the entry points which use the document kept by `run_pipeline`.
 */
export type RustDocumentRequests = {
  print_outputs: RustOutputRequest;
  print_sdl_without_metadata: null;
  locate: RustLocateRequest;
};

/**
 * A diagnostic reported by Rust. See `Diagnostic` in
 * `grats-rs/crates/grats/src/utils/diagnostic_error.rs`.
 */
export type EncodedDiagnostic = {
  messageText: string;
  loc: EncodedLocation | null;
  relatedInformation: Array<{
    messageText: string;
    loc: EncodedLocation;
  }> | null;
  // Offsets are UTF-16, like those of a `ts.CodeFixAction`.
  fix?: ts.CodeFixAction;
};

export function decodeDiagnostic(
  diagnostic: EncodedDiagnostic,
  sources: SourceTable,
): FixableDiagnostic {
  if (diagnostic.loc == null) {
    return locationlessErr(diagnostic.messageText);
  }
  const decoded: FixableDiagnostic = gqlErr(
    { loc: sources.decodeLocation(diagnostic.loc) },
    diagnostic.messageText,
    diagnostic.relatedInformation?.map((related) =>
      gqlRelated(
        { loc: sources.decodeLocation(related.loc) },
        related.messageText,
      ),
    ),
  );
  if (diagnostic.fix != null) {
    decoded.fix = diagnostic.fix;
  }
  return decoded;
}
