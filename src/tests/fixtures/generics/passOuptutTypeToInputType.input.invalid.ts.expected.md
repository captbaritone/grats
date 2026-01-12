# generics/passOuptutTypeToInputType.input.invalid.ts

## Input

```ts title="generics/passOuptutTypeToInputType.input.invalid.ts"
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
```

## Output

### Error Report

```text
src/tests/fixtures/generics/passOuptutTypeToInputType.input.invalid.ts:3:14 - error: The type of SomeClassSomeInput.someField must be Input Type but got: SomeClass!.

3   someField: T;
               ~
```