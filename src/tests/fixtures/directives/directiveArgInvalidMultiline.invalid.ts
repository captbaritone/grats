/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(args: { foo: string; bar: string }) {}

/**
 * @gqlQueryField
 * @gqlAnnotate customDirective(
 *   foo: "foo",
 *   bar: 10
 * )
 */
export function myQueryField(): string {
  return "myQueryField";
}
