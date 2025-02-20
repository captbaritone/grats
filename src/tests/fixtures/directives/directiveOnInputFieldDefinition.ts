import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on INPUT_FIELD_DEFINITION
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlInput
 */
type MyType = {
  /** @gqlAnnotate max(foo: 10) */
  myField: string;
};
