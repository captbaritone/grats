## input

```ts title="extend_type/fieldAsExportedNothing.invalid.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export const greeting;
```

## Output

### Error Report

```text
src/tests/fixtures/extend_type/fieldAsExportedNothing.invalid.ts:7:1 - error: Expected `@gqlField` on variable declaration to be attached to an arrow function.

7 export const greeting;
  ~~~~~~~~~~~~~~~~~~~~~~
```