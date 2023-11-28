/** @gqlType */
export class Subscription {
  /** @gqlField */
  async *greetings(): AsyncIterable<string> {
    yield "Hello";
    yield "World";
  }
}
