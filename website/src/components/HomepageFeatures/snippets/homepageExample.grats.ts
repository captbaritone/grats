/**
 * A user in our kick-ass system!
 * @gqlType */
class User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  greet(greeting: string): string {
    return `${greeting}, ${this.name}`;
  }
}
