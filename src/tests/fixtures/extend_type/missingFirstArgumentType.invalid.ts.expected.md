## input

```ts title="extend_type/missingFirstArgumentType.invalid.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export function greeting(
  query /* Without an arg type we can't infer the GraphQL type to extend! */,
): string {
  return "Hello world!";
}
```

## Output

### Error Report

```text
src/tests/fixtures/extend_type/missingFirstArgumentType.invalid.ts:8:3 - error: Expected first argument of a `@gqlField` function to have an explicit type annotation. Grats treats the first argument as the parent object of the field. Therefore Grats needs to see the _type_ of the first argument in order to know to which type/interface this field should be added.

8   query /* Without an arg type we can't infer the GraphQL type to extend! */,
    ~~~~~
```