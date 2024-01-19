/** @gqlType */
class User {
  /** @gqlField */
  greeting(name: string = "Alice", salutation: string = "Hello"): string {
    return `${salutation} ${name}`;
  }
}
