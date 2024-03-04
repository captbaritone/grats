/** @gqlInterface */
interface Person {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class User implements Person {
  __typename = "User";
  name: string;

  // highlight-start
  /**
   * For `User` this method will be used instead of the `name` property.
   *
   * @gqlField name
   */
  userSpecificName(): string {
    return `User: this.name`;
  }
  // highlight-end
}
