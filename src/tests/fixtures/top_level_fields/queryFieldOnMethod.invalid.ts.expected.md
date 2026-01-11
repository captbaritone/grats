# top_level_fields/queryFieldOnMethod.invalid.ts

## Input

```ts title="top_level_fields/queryFieldOnMethod.invalid.ts"
export class SomeNonGraphQLClass {
  /** @gqlQueryField */
  greeting(): string {
    return "Hello world";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/top_level_fields/queryFieldOnMethod.invalid.ts:2:7 - error: `@gqlQueryField` can only be used on function or static method declarations.

2   /** @gqlQueryField */
        ~~~~~~~~~~~~~~~
```