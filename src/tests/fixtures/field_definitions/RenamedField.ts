/** @GQLType */
class Query {
  /**
   * @GQLField
   * @name greeting
   */
  somePropertyField: string;

  /**
   * @GQLField
   * @name salutaion
   */
  someMethodField(): string {
    return "Hello world!";
  }
}
