export class SomeNonGraphQLClass {
  /** @gqlQueryField */
  static greeting(): string {
    return "Hello world";
  }
}
