/** @gqlField */
async function greet(_: Query): Promise<string> {
  return "Hello, World!";
}

/** @gqlType */
export type Query = unknown;
