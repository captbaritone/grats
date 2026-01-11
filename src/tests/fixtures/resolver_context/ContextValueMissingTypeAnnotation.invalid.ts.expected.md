# resolver_context/ContextValueMissingTypeAnnotation.invalid.ts

## Input

```ts title="resolver_context/ContextValueMissingTypeAnnotation.invalid.ts"
/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx): string {
    return ctx.greeting;
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/resolver_context/ContextValueMissingTypeAnnotation.invalid.ts:4:12 - error: Missing type annotation for resolver argument. Expected all resolver arguments to have an explicit type annotation. Grats needs to be able to see the type of the arguments to generate an executable GraphQL schema.

4   greeting(ctx): string {
             ~~~
```