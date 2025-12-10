## input

```ts title="input_types/InputTypeReferencingOutputType.invalid.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  someField(args: { input: MyInputType }): string;
}

/** @gqlInput */
type MyInputType = {
  someField: SomeType;
};
```

## Output

```
src/tests/fixtures/input_types/InputTypeReferencingOutputType.invalid.ts:9:14 - error: The type of MyInputType.someField must be Input Type but got: SomeType!.

9   someField: SomeType;
               ~~~~~~~~
```