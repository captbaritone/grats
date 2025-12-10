## input

```ts title="input_types/ContextReferencedInInputType.invalid.ts"
/** @gqlContext */
type SomeType = {
  hello: string;
};

/** @gqlInput */
type MyInputType = {
  someField: SomeType;
};
```

## Output

### Error Report

```text
src/tests/fixtures/input_types/ContextReferencedInInputType.invalid.ts:8:14 - error: Cannot use `gqlContext` as a type in GraphQL type position.

8   someField: SomeType;
               ~~~~~~~~

  src/tests/fixtures/input_types/ContextReferencedInInputType.invalid.ts:1:5
    1 /** @gqlContext */
          ~~~~~~~~~~~~
    Defined here
```