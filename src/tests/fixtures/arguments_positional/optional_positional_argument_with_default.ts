/** @gqlType */
class User {
  /** @gqlField */
  greeting(name: string | null = "Alice"): string {
    return `Hello ${name}`;
  }
}
