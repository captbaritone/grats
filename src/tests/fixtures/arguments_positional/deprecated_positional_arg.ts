/** @gqlType */
class User {
  /** @gqlField */
  greeting(
    /** @deprecated Don't use this any more */
    name?: string | null,
  ): string {
    return `Hello ${name || "Alice"}`;
  }
}
