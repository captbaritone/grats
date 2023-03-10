/** @GQLType */
class Query {
  /** @GQLField greeting */
  somePropertyField: string;

  /** @GQLField salutaion */
  someMethodField(): string {
    return "Hello world!";
  }
}
