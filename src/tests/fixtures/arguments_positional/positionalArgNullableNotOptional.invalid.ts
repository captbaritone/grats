/** @gqlType */
class User {
  /** @gqlField */
  name: string = "John Doe";
  /** @gqlField */
  greeting(greeting: string | null): string {
    return `${greeting}, ${this.name}!`;
  }
}
