/**
 * A user in our kick-ass system!
 * @gqlType */
class User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  greet(args: { greeting: string }): string {
    return `${args.greeting}, ${this.name}`;
  }
}
