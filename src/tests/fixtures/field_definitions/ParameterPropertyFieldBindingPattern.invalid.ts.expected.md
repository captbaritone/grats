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
src/tests/fixtures/field_definitions/ParameterPropertyFieldBindingPattern.invalid.ts:5:5 - error: A parameter property may not be declared using a binding pattern.

5     public [foo]: string,
      ~~~~~~~~~~~~~~~~~~~~
```