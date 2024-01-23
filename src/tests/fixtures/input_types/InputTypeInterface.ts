/** @gqlInput */
interface MyInputType {
  someField: string;
}

/** @gqlType */
class User {
  /** @gqlField */
  myField(args: { input: MyInputType }): string {
    return args.input.someField;
  }
}
