/** @gqlType */
class User {
  /** @gqlField */
  name: string = "John Doe";
  /** @gqlField */
  greeting(
    /** Greeting to use when greeting the user. */
    greeting: string,
  ): string {
    return `${greeting}, ${this.name}!`;
  }
}
