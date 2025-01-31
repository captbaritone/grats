/**
 * @gqlInput
 */
type MyInput = { a: string };
/**
 * This is my custom directive.
 * @gqlDirective
 * @on FIELD_DEFINITION
 */
export function customDirective(args: { foo: MyInput }) {}

/**
 * @gqlQueryField
 * @customDirective(foo: {a: 10})
 */
export function myQueryField(): string {
  return "myQueryField";
}
