// { "EXPERIMENTAL__emitResolverMap": true }

import {
  SomeType as _SomeType,
  SomeInterface as _SomeInterface,
} from "./nonGratsPackage.ignore";

/**
 * @gqlType MyType
 * @gqlExternal "./test-sdl.graphql"
 */
export type SomeType = _SomeType;

/**
 * @gqlField
 */
export function someField(parent: SomeType): string {
  return parent.id;
}
