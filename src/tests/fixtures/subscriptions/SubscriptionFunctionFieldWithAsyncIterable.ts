/** @gqlType */
export type Subscription = unknown;

/** @gqlField */
export async function* greetings(_: Subscription): AsyncIterable<string> {
  yield "Hello";
  yield "World";
}
