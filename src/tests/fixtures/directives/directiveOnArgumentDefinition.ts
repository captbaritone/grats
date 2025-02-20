import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on ARGUMENT_DEFINITION
 */
export function max(args: { foo: Int }) {}

/**
 * All likes in the system. Note that there is no guarantee of order.
 * @gqlQueryField */
export function likes(args: {
  /** @gqlAnnotate max(foo: 10) */
  first?: Int | null;
}): string {
  return "hello";
}
