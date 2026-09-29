import { DocumentNode, Location, Source, Token, TokenKind } from "graphql";
import * as ts from "typescript";

/**
 * Encodes values passed between TypeScript and the Rust port of Grats
 * (compiled to wasm) as JSON strings.
 *
 * Most of what crosses is already plain data. The exception is graphql-js
 * `Location`, which references its entire `Source` text, so locations are
 * encoded as offsets into a `SourceTable` which stays on the TypeScript side.
 */

export type EncodedLocation = {
  /** Index into the `SourceTable` used to encode the location. */
  source: number;
  start: number;
  end: number;
};

/**
 * The sources referenced by encoded locations. Use the same table to decode
 * a value as was used to encode it.
 *
 * Sources are identified by name and text rather than by name alone, since
 * GraphQL parsed from docblocks (e.g. `@gqlAnnotate`) gets its own
 * "GraphQL request" source for each docblock tag.
 */
export class SourceTable {
  private _sources: Array<{ source: Source; lines: ts.SourceFileLike }> = [];
  private _idsByName: Map<string, number[]> = new Map();

  encodeLocation(loc: Location): EncodedLocation {
    return {
      source: this._sourceId(loc.source),
      start: loc.start,
      end: loc.end,
    };
  }

  /**
   * Rebuilds a location with the same shape as those created during
   * extraction by `loc()` in `GraphQLConstructor.ts`.
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

  private _sourceId(source: Source): number {
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
 * Encodes a document, including Grats' metadata fields (see
 * `GraphQLAstExtensions.ts`).
 */
export function encodeDocument(
  doc: DocumentNode,
  sources: SourceTable,
): string {
  return JSON.stringify(doc, function (key, value) {
    // Location defines `toJSON`, so read the original value from the holder.
    // Unlike a reviver in `decodeDocument`, a replacer is about as fast as
    // walking the value ourselves.
    const original = this[key];
    if (key === "loc" && original != null) {
      return sources.encodeLocation(original);
    }
    return value;
  });
}

export function decodeDocument(
  json: string,
  sources: SourceTable,
): DocumentNode {
  const doc = JSON.parse(json);
  decodeLocations(doc, sources);
  return doc;
}

// Replaces encoded locations in place. We walk the parsed value ourselves
// since passing a reviver to `JSON.parse` is several times slower.
function decodeLocations(value: unknown, sources: SourceTable): void {
  if (typeof value !== "object" || value === null) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      decodeLocations(item, sources);
    }
    return;
  }
  const object = value as Record<string, unknown>;
  for (const key in object) {
    const child = object[key];
    if (key === "loc") {
      if (child != null) {
        object[key] = sources.decodeLocation(child as EncodedLocation);
      }
    } else {
      decodeLocations(child, sources);
    }
  }
}
