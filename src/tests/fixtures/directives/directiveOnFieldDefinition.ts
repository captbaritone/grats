import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function max(args: { foo: Int }) {}

/**
 * All likes in the system. Note that there is no guarantee of order.
 * @gqlQueryField
 * @gqlAnnotate max(foo: 10)
 */
export function likes(args: { first?: Int | null }): string {
  return "hello";
}
