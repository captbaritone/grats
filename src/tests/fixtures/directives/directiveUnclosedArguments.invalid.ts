// The tag ends before the arguments do, so the error is reported at the tag.

/**
 * @gqlQueryField
 * @gqlAnnotate myDirective(someArg: "oops"
 */
export function myQueryField(): string {
  return "myQueryField";
}
