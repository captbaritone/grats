import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on UNION
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlUnion
 * @gqlAnnotate max(foo: 10)
 */
type MyUnion = A | B;

/**
 * @gqlType
 */
type A = {
  __typename: "A";
  /** @gqlField */
  myField: string;
};

/**
 * @gqlType
 */
type B = {
  __typename: "B";
  /** @gqlField */
  myField: string;
};
