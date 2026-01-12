# extend_type/fieldAsExportedNumber.invalid.ts

## Input

```ts title="extend_type/fieldAsExportedNumber.invalid.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export const greeting = 10;
```

## Output

### Error Report

```text
src/tests/fixtures/extend_type/fieldAsExportedNumber.invalid.ts:7:1 - error: Expected `@gqlField` on variable declaration to be attached to an arrow function.

7 export const greeting = 10;
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~
```