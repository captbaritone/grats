import { DocumentNode, Location, TokenKind } from "graphql";
import { decodeDocument, encodeDocument, SourceTable } from "../rs/codec.js";

/**
 * Asserts that `doc` survives being encoded and decoded by the codec used to
 * pass documents to and from Rust. Throws if it does not.
 */
export function assertDocumentRoundTrips(doc: DocumentNode): void {
  const sources = new SourceTable();
  const json = encodeDocument(doc, sources);
  const decoded = decodeDocument(json, sources);
  assertSame(doc, decoded, "doc");
  if (encodeDocument(decoded, sources) !== json) {
    throw new Error("Codec round trip: re-encoding produced different JSON.");
  }
}

function assertSame(expected: unknown, actual: unknown, path: string): void {
  const fail = (reason: string) => {
    throw new Error(`Codec round trip: ${reason} at \`${path}\`.`);
  };
  if (expected instanceof Location) {
    if (!(actual instanceof Location)) {
      return fail("expected a Location");
    }
    if (
      actual.source.name !== expected.source.name ||
      actual.source.body !== expected.source.body ||
      actual.start !== expected.start ||
      actual.end !== expected.end
    ) {
      return fail("location differs");
    }
    // Locations created during extraction carry the TypeScript line and
    // character, which `grats locate` reports. Locations parsed from GraphQL
    // text only ever contribute their offsets.
    if (expected.startToken.kind === TokenKind.SOF) {
      for (const key of ["startToken", "endToken"] as const) {
        if (
          actual[key].line !== expected[key].line ||
          actual[key].column !== expected[key].column
        ) {
          return fail(`${key} line/column differs`);
        }
      }
    }
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      return fail("array differs");
    }
    expected.forEach((item, i) => assertSame(item, actual[i], `${path}[${i}]`));
    return;
  }
  if (typeof expected === "object" && expected !== null) {
    if (typeof actual !== "object" || actual === null) {
      return fail("expected an object");
    }
    // JSON drops properties whose value is `undefined`.
    const keys = new Set(
      [...Object.entries(expected), ...Object.entries(actual)]
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key),
    );
    for (const key of keys) {
      assertSame(expected[key], actual[key], `${path}.${key}`);
    }
    return;
  }
  if (actual !== expected) {
    return fail(`expected ${String(expected)} but got ${String(actual)}`);
  }
}
