/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({ greet = false }: { greet?: boolean }): string {
    if (!greet) return "";
    return "hello";
  }

  /** @gqlField */
  someField2({ greet = true }: { greet?: boolean }): string {
    if (!greet) return "";
    return "hello";
  }
}
