import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on INTERFACE
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlInterface
 * @gqlAnnotate max(foo: 10)
 */
interface MyInterface {
  /** @gqlField */
  myField: string;
}
