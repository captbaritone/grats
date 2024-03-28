/** @gqlInput */
export type SomeInput<T> = {
  someField: T;
};

/** @gqlInput */
type AnotherInput = {
  anotherField: string;
};

/** @gqlType */
class SomeClass {
  /** @gqlField */
  someField(args: { someArg: SomeInput<SomeClass> }): string {
    return args.someArg.someField.someField(args);
  }
}
