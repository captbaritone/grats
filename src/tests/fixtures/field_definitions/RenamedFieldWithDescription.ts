/** @GQLType */
class Query {
  /**
   * Number 1 greeting.
   *
   * @GQLField greeting
   */
  somePropertyField: string;

  /**
   * Number 1 salutation.
   *
   * @GQLField salutaion
   */
  someMethodField(): string {
    return "Hello world!";
  }
}
