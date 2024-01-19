/** @gqlType */
class User {
  /** @gqlField */
  greeting(
    /**
     * A great name
     * @deprecated
     */
    name?: string | null,
  ): string {
    return `Hello ${name}`;
  }
}
