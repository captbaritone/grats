import type { ExtractionSnapshot } from "../Extractor.js";
import type { NameResolver } from "../NameResolver.js";
import type { EntityNameRef } from "../snapshotRefs.js";
import type { RustNameResolution } from "./codec.js";

/**
 * The checker only exists on the TypeScript side, so it answers ahead of time
 * for everything the Rust port of Grats may ask the resolver about the
 * snapshot. See `CheckerNameResolution` in
 * `grats-rs/crates/grats/src/checker_name_resolver.rs`.
 */
export function resolveNamesForRust(
  resolver: NameResolver,
  snapshot: ExtractionSnapshot,
): RustNameResolution {
  const resolvedEntityNames: RustNameResolution["resolvedEntityNames"] = [];
  const resolve = (ref: EntityNameRef, withLoc: boolean) => {
    const declarations = resolver
      .resolveEntityName(ref.name)
      .map(({ kind, declLoc, loc }) => ({
        kind,
        declLoc,
        // Computed lazily, so only included where it may be read.
        loc: withLoc || kind === "TYPE_PARAMETER" ? loc : null,
      }));
    resolvedEntityNames.push([ref.name, declarations]);
  };

  // The unresolved names, and those in their type arguments.
  const resolveUnresolvedName = (ref: EntityNameRef) => {
    resolve(ref, false);
    for (const arg of ref.typeArguments ?? []) {
      if (arg.kind === "ENTITY_NAME") {
        resolveUnresolvedName(arg);
      }
    }
  };
  for (const ref of snapshot.unresolvedNames.values()) {
    resolveUnresolvedName(ref);
  }
  // The references of implicit name definitions, whose declarations are
  // reported if they're defined more than once. They come last so that their
  // answers, with locations, are the ones kept for any name resolved twice.
  for (const ref of snapshot.implicitNameDefinitions.values()) {
    resolve(ref, true);
  }

  return {
    resolvedEntityNames,
    mergedDeclarations: snapshot.interfaceDeclarations.map((declaration) => [
      declaration.declLoc,
      resolver.mergedDeclarations(declaration),
    ]),
  };
}
