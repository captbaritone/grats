/** @gqlType */
class User {
  // Not deprecated!
  name: string;

  /**
   * @gqlField name
   * @deprecated Not supported externally any more
   */
  graphQLName(): string {
    return this.name;
  }
}
