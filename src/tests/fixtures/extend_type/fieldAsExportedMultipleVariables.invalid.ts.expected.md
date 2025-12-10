## input

```ts title="extend_type/fieldAsExportedMultipleVariables.invalid.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export const greeting = (_: SomeType): string => {
    return `Hello World`;
  },
  anotherGreeting = (_: SomeType): string => {
    return `Hello World`;
  };
```

## Output

### Error Report

```text
src/tests/fixtures/extend_type/fieldAsExportedMultipleVariables.invalid.ts:7:1 - error: Expected only one declaration when defining a `@gqlField`, found 2.

  7 export const greeting = (_: SomeType): string => {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  8     return `Hello World`;
    ~~~~~~~~~~~~~~~~~~~~~~~~~
... 
 11     return `Hello World`;
    ~~~~~~~~~~~~~~~~~~~~~~~~~
 12   };
    ~~~~
```