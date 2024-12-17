// { "EXPERIMENTAL__emitResolverMap": true }

import { Int } from "../../../Types";
import { SomeInputType as _SomeInputType } from "./nonGratsPackage.ignore";

/**
 * @gqlInput MyInput
 * @gqlExternal "./test-sdl.ignore.graphql"
 */
type MyInputType = _SomeInputType;

/**
 * @gqlInput
 */
type NestedInput = {
  my: MyInputType;
};

/** @gqlQueryField */
export function myRoot(my: MyInputType, nested: NestedInput): Int | null {
  return null;
}
