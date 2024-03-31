/** @gqlType */
class User {
  /** @gqlField */
  name: string = "John Doe";
  /** @gqlField */
  greeting(greeting: string = "Hello"): string {
    return `${greeting}, ${this.name}!`;
  }
}
