import { Location } from "graphql";
import { DeclLoc, DeclRef } from "./snapshotRefs.js";

/**
 * Answers the questions Grats needs to ask about what TypeScript names refer
 * to. Grats treats types nominally, so this is purely a matter of following
 * names (through imports and exports) to their declarations. No type
 * information is required.
 */
export interface NameResolver {
  /**
   * Returns the declarations of the symbol referenced by the entity name at
   * `name`, after following any aliases such as imports. Returns an empty
   * array if the name cannot be resolved.
   */
  resolveEntityName(name: Location): ResolvedDeclaration[];

  /**
   * Returns every declaration merged with `declaration` (including
   * `declaration` itself). See
   * https://www.typescriptlang.org/docs/handbook/declaration-merging.html
   */
  mergedDeclarations(declaration: DeclRef): MergedDeclaration[];
}

export type ResolvedDeclaration = {
  kind: "TYPE_PARAMETER" | "DECLARATION";
  declLoc: DeclLoc;
  /** The whole declaration, for diagnostics. */
  readonly loc: Location;
};

export type MergedDeclaration = {
  kind: "INTERFACE" | "CLASS" | "OTHER";
  declLoc: DeclLoc;
  /** The declaration's name, or the whole declaration if it's anonymous. */
  readonly name: Location;
};
