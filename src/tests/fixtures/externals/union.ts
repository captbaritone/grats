// { "EXPERIMENTAL__emitResolverMap": true }

import { SomeUnion as _SomeUnion } from "./nonGratsPackage.ignore";

/**
 * @gqlType MyUnion
 * @gqlExternal "./test-sdl.ignore.graphql"
 */
export type SomeUnion = _SomeUnion;

/** @gqlQueryField */
export function myRoot(): SomeUnion {
  return {
    __typename: "MyType",
    id: "foo",
  };
}
