/** @gqlType */
class User {
  /** @gqlField */
  name: string = "John Doe";
  /** @gqlField */
  greeting(greeting: string): string {
    return `${greeting}, ${this.name}!`;
  }
}
