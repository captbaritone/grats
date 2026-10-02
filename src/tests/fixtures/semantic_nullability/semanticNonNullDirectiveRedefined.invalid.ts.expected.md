# semantic_nullability/semanticNonNullDirectiveRedefined.invalid.ts

## Input

```ts title="semantic_nullability/semanticNonNullDirectiveRedefined.invalid.ts"
// { "strictSemanticNullability": true }

/**
 * @gqlDirective on FIELD_DEFINITION
 */
export function semanticNonNull() {}

/** @gqlType */
export class User {
  /** @gqlField */
  name(): string {
    return "Alice";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/semantic_nullability/semanticNonNullDirectiveRedefined.invalid.ts:6:17 - error: There can be only one directive named "@semanticNonNull".

6 export function semanticNonNull() {}
                  ~~~~~~~~~~~~~~~
```