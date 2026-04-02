/**
 * A user in our kick-ass system!
 * @gqlType */
export class User {
  /** @gqlQueryField */
  static me(): User {
    return new User();
  }

  /** @gqlField */
  name: string = "Alice";

  /** @gqlField */
  greeting(salutation: string): string {
    return `${salutation}, ${this.name}`;
  }
}
