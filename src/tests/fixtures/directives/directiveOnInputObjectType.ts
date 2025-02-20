import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on INPUT_OBJECT
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlInput
 * @gqlAnnotate max(foo: 10)
 */
type MyType = {
  myField: string;
};
