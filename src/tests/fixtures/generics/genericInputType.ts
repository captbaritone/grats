/** @gqlInput */
type SomeInput<T> = {
  someField: T;
};

/** @gqlInput */
type AnotherInput = {
  anotherField: string;
};

/** @gqlType */
class SomeClass {
  /** @gqlField */
  someField(args: { someArg: SomeInput<AnotherInput> }): string {
    return args.someArg.someField.anotherField;
  }
}
