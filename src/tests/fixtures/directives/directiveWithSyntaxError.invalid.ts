// Because @myDirective is followed by `(` we assume it's expected to be parsed
// as a directive even though it's not defined.

/**
 * @gqlQueryField
 * @gqlAnnotate myDirective(someArg: --oops)
 */
export function myQueryField(): string {
  return "myQueryField";
}
