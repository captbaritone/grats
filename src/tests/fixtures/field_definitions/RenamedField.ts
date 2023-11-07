/** @gqlType */
class SomeType {
  /** @gqlField greeting */
  somePropertyField: string;

  /** @gqlField salutaion */
  someMethodField(): string {
    return "Hello world!";
  }
}
