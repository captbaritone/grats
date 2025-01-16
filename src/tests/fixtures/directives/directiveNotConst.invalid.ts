// Because @myDirective is followed by `(` we assume it's expected to be parsed
// as a directive even though it's not defined.

/**
 * @gqlQueryField
 * @myDirective(someArg: $foo)
 */
export function myQueryField(): string {
  return "myQueryField";
}
