/** @gqlField */
function greet(_: Query): string {
  return "Hello, World!";
}

/** @gqlType */
type Query = unknown;
