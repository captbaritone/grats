/**
 * @gqlInput
 * @oneOf
 */
type MyInput = { a: string } | { b: string };
/**
 * This is my custom directive.
 * @gqlDirective
 * @on FIELD_DEFINITION
 */
export function customDirective(args: { foo: MyInput }) {}

/**
 * @gqlQueryField
 * @customDirective(foo: {a: "a", b: "b"})
 */
export function myQueryField(): string {
  return "myQueryField";
}
