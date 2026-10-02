/**
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(args: { foo: string }) {}

/**
 * @gqlQueryField
 * @gqlAnnotate customDirective(foo: "a", bar: "b")
 */
export function myQueryField(): string {
  return "myQueryField";
}
