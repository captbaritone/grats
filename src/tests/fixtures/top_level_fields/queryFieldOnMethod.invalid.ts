export class SomeNonGraphQLClass {
  /** @gqlQueryField */
  greeting(): string {
    return "Hello world";
  }
}
