import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on ENUM_VALUE
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlEnum
 */
enum MyEnum {
  /** @gqlAnnotate max(foo: 10) */
  a = "A",
  b = "B",
}
