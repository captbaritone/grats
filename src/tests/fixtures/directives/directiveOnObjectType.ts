import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on OBJECT
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlType
 * @gqlAnnotate max(foo: 10)
 */
type MyType = {
  /** @gqlField */
  myField: string;
};
