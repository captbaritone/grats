// { "EXPERIMENTAL__emitResolverMap": false }

import {
  SomeType as _SomeType,
  SomeInterface as _SomeInterface,
} from "./nonGratsPackage.ignore";

/**
 * @gqlType MyType
 * @gqlExternal "./test-sdl.ignore.graphql"
 */
export type SomeType = _SomeType;

/**
 * @gqlType MyType
 * @gqlExternal
 */
export type OtherType = _SomeType;

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
