/** @gqlType */
class User {
  /** @gqlField */
  greeting(name: string, salutation: string): string {
    return `${salutation} ${name}`;
  }
}
