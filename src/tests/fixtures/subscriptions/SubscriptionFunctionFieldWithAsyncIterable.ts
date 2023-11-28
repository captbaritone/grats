/** @gqlType */
export type Subscription = {};

/** @gqlField */
export async function* greetings(_: Subscription): AsyncIterable<string> {
  yield "Hello";
  yield "World";
}
