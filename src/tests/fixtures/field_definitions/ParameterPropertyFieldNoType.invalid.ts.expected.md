# field_definitions/ParameterPropertyFieldNoType.invalid.ts

## Input

```ts title="field_definitions/ParameterPropertyFieldNoType.invalid.ts"
/** @gqlType */
export default class SomeType {
  constructor(
    /** @gqlField */
    public hello,
  ) {}
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/ParameterPropertyFieldNoType.invalid.ts:5:5 - error: Expected `@gqlField` parameter property to have an explicit type annotation. Grats needs to be able to see the type of the parameter property to generate a GraphQL schema.

5     public hello,
      ~~~~~~~~~~~~
```