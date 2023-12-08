/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({
    inputs = ["hello", "there"],
  }: {
    inputs?: string[] | null;
  }): string {
    if (inputs === null) {
      return "got null";
    }
    return inputs.join("|");
  }
}
