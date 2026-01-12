# field_definitions/ParameterPropertyFieldBindingPattern.invalid.ts

## Input

```ts title="field_definitions/ParameterPropertyFieldBindingPattern.invalid.ts"
/** @gqlType */
export default class SomeType {
  constructor(
    /** @gqlField */
    public [foo]: string,
  ) {}
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/ParameterPropertyFieldBindingPattern.invalid.ts:5:12 - error: Expected a name identifier. Grats expected to find a name here which it could use to derive the GraphQL name.

5     public [foo]: string,
             ~~~~~
```