/** @gqlType */
export class User {
  /** @gqlField */
  private greet(): string {
    return "Hello";
  }
  /** @gqlField */
  protected greet2(): string {
    return "Hello";
  }
}
