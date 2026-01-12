# extend_type/fieldAsArrowFunctionLet.invalid.ts

## Input

```ts title="extend_type/fieldAsArrowFunctionLet.invalid.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export let greeting = (_: SomeType): string => {
  return `Hello World`;
};
```

## Output

### Error Report

```text
src/tests/fixtures/extend_type/fieldAsArrowFunctionLet.invalid.ts:7:8 - error: Expected `@gqlField` arrow function to be declared as `const`.

7 export let greeting = (_: SomeType): string => {
         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
8   return `Hello World`;
  ~~~~~~~~~~~~~~~~~~~~~~~
9 };
  ~
```