/** @gqlType */
class User {
  /** @gqlField */
  name: string = "John Doe";
  /** @gqlField */
  greeting(
    /** @deprecated Prefer the default value */
    greeting: string = "Hello",
  ): string {
    return `${greeting}, ${this.name}!`;
  }
}
