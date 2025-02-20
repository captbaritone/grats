import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on SCALAR
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlScalar
 * @gqlAnnotate max(foo: 10)
 */
type MyScalar = string;
