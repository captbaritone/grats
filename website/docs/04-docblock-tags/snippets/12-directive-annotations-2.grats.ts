// trim-start
/** @gqlDirective on FIELD_DEFINITION */
function myDirective(args: { someArg: string }) {
  // ...
}
// trim-end
/**
 * @gqlQueryField
 * @gqlAnnotate myDirective(someArg: "Some String")
 */
export function greet(): string {
  return "Hello";
}
