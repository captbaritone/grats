// { "nullableByDefault": false }
/** @gqlType */
export type Subscription = unknown;

/** @gqlField */
export async function* greetings(_: Subscription): AsyncIterable<string> {
  yield "Hello";
  yield "World";
}

/** @gqlField */
export async function* maybeGreetings(
  _: Subscription,
): AsyncIterable<string> | null {
  yield "Hello";
  yield "World";
}

/** @gqlField */
export async function* greetingsMaybe(
  _: Subscription,
): AsyncIterable<string | null> {
  yield "Hello";
  yield null;
  yield "World";
}

/** @gqlField */
export async function* maybeGreetingsMaybe(
  _: Subscription,
): AsyncIterable<string | null> | null {
  return null;
}
