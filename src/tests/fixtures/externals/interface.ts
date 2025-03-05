// { "EXPERIMENTAL__emitResolverMap": true }

import { ID } from "../../../Types";
import { SomeInterface as _SomeInterface } from "./nonGratsPackage.ignore";

/**
 * @gqlInterface MyInterface
 * @gqlExternal "./test-sdl.ignore.graphql"
 */
export type SomeType = _SomeInterface;

/**
 * @gqlType
 */
interface ImplementingType extends SomeType {
  __typename: "ImplementingType";
  /**
   * @gqlField
   * @killsParentOnException
   */
  id: ID;
  /** @gqlField */
  otherField: string;
}

/**
 * @gqlField
 */
export function someField(parent: ImplementingType): string {
  return parent.id;
}

/** @gqlQueryField */
export function myRoot(): ImplementingType | null {
  return null;
}
