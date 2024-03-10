// { "nullableByDefault": false }
/** @gqlType */
export class User {
  /** @gqlField */
  async *greetings(): AsyncIterable<string> {
    yield "Hello";
    yield "World";
  }

  /** @gqlField */
  async *maybeGreetings(): AsyncIterable<string> | null {
    null;
  }
  /** @gqlField */
  async *greetingsMaybe(): AsyncIterable<string | null> {
    null;
  }

  /** @gqlField */
  async *maybeGreetingsMaybe(): AsyncIterable<string | null> | null {
    null;
  }
}
