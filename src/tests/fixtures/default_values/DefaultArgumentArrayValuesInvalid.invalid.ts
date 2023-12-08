/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({
    inputs = [func(), func()],
  }: {
    inputs?: string[] | null;
  }): string {
    if (inputs === null) {
      return "got null";
    }
    return inputs.join("|");
  }
}

function func(): string {
  return "sup";
}
