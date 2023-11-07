/** @gqlType */
class SomeType {
  /** @gqlField */
  someField(args: { input: MyInputType }): string;
}

/** @gqlInput */
type MyInputType = {
  someField: SomeType;
};
