/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(args: { foo: string }) {}

/**
 * @gqlQueryField
 * @gqlAnnotate customDirective(foo: 10)
 */
export function myQueryField(): string {
  return "myQueryField";
}
