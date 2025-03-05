// { "EXPERIMENTAL__emitResolverMap": true }

import {
  SomeScalar as _SomeScalar,
  SomeEnum as _SomeEnum,
} from "./nonGratsPackage.ignore";

/**
 * @gqlInput MyScalar
 * @gqlExternal "./test-sdl.ignore.graphql"
 */
type SomeScalar = _SomeScalar;

/**
 * @gqlInput MyEnum
 * @gqlExternal "./test-sdl.ignore.graphql"
 */
type SomeEnum = _SomeEnum;

/**
 * @gqlInput
 */
type NestedInput = {
  my: SomeScalar;
  enum: SomeEnum;
};

/**
 * @gqlType
 */
type NestedObject = {
  /** @gqlField */
  my: SomeScalar;
  /** @gqlField */
  enum: SomeEnum;
};

/** @gqlQueryField */
export function myRoot(
  my: SomeScalar,
  nested: NestedInput,
): NestedObject | null {
  return null;
}
