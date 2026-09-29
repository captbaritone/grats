import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlQueryField
 * @gqlAnnotate max(foo: 10)
 */
export function likes(): string {
  return "hello";
}

/**
 * @gqlQueryField
 * @gqlAnnotate max(foo: 20)
 */
export function shares(): string {
  return "hello";
}
