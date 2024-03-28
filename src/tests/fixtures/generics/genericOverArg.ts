/** @gqlType */
export class SomeClass<T> {
  /** @gqlField */
  someField(args: { someArg?: T | null }): string {
    return "someField";
  }
}

/** @gqlInput */
type SomeInput = {
  someField: string;
};

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function someField(_: Query): SomeClass<SomeInput> {
  return new SomeClass();
}
