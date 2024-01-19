/** @gqlType */
class User {
  /** @gqlField */
  greeting(
    /** Name of the person to greet */
    name: string,
  ): string {
    return `Hello ${name}`;
  }
}
