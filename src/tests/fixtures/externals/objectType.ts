// { "EXPERIMENTAL__emitResolverMap": true }

import { SomeType as _SomeType } from "./nonGratsPackage.ignore";

/**
 * @gqlType MyType
 * @gqlExternal "./test-sdl.ignore.graphql"
 */
export type SomeType = _SomeType;

/**
 * @gqlField
 */
export function someField(parent: SomeType): string {
  return parent.id;
}

/** @gqlQueryField */
export function myRoot(): SomeType | null {
  return null;
}
