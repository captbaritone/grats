import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on ENUM
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlEnum
 * @gqlAnnotate max(foo: 10)
 */
type MyEnum = "A" | "B";
