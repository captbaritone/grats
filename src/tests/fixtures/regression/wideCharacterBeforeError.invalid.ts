// A diagnostic inside a docblock is reported at offsets the GraphQL lexer
// counts in UTF-8 bytes, which Grats converts to the UTF-16 ones editors use.
// The wide characters before the error are what tell the two apart.

/**
 * @gqlQueryField
 * @gqlAnnotate myDirective(greeting: "héllo 🌍", someArg: --oops)
 */
export function myQueryField(): string {
  return "myQueryField";
}
