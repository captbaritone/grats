// trim-start
/** @gqlDirective on FIELD_DEFINITION */
function myDirective() {
  // ...
}
// trim-end
/**
 * @gqlQueryField
 * @gqlAnnotate myDirective
 */
export function greet(): string {
  return "Hello";
}
