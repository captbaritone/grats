/** @gqlField */
async function greet(_: Query): Promise<string> {
  return "Hello, World!";
}

/** @gqlType */
type Query = unknown;
