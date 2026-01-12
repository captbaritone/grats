# extend_type/fieldAsArrowFunctionVar.invalid.ts

## Input

```ts title="extend_type/fieldAsArrowFunctionVar.invalid.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
var greeting = (_: SomeType): string => {
  return `Hello World`;
};
```

## Output

### Error Report

```text
src/tests/fixtures/extend_type/fieldAsArrowFunctionVar.invalid.ts:7:1 - error: Expected `@gqlField` arrow function to be declared as `const`.

7 var greeting = (_: SomeType): string => {
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
8   return `Hello World`;
  ~~~~~~~~~~~~~~~~~~~~~~~
9 };
  ~
```