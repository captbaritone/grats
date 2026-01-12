# input_types/InputTypeMergedInterface.invalid.ts

## Input

```ts title="input_types/InputTypeMergedInterface.invalid.ts"
interface MyInputType {
  secretConfusingField: string;
}

/** @gqlInput */
interface MyInputType {
  someField: string;
}
```

## Output

### Error Report

```text
src/tests/fixtures/input_types/InputTypeMergedInterface.invalid.ts:6:11 - error: Unexpected merged interface. If an interface is declared multiple times in a scope, TypeScript merges them. To avoid ambiguity Grats does not support using merged interfaces as GraphQL definitions. Consider using a unique name for your TypeScript interface and renaming it.

 Learn more: https://grats.capt.dev/docs/docblock-tags/interfaces/#merged-interfaces

6 interface MyInputType {
            ~~~~~~~~~~~

  src/tests/fixtures/input_types/InputTypeMergedInterface.invalid.ts:1:11
    1 interface MyInputType {
                ~~~~~~~~~~~
    Other declaration
```