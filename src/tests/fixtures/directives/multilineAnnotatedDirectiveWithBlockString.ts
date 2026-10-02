/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(args: { foo: string; bar: string }) {}

/**
 * @gqlQueryField
 * @gqlAnnotate customDirective(
 *   foo: """
 *     First line
 *       Indented line
 *   """,
 *   bar: "bar"
 * )
 */
export function myQueryField(): string {
  return "myQueryField";
}
