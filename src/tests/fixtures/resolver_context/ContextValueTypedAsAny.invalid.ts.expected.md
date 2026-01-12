# resolver_context/ContextValueTypedAsAny.invalid.ts

## Input

```ts title="resolver_context/ContextValueTypedAsAny.invalid.ts"
/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: any): string {
    return ctx.greeting;
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/resolver_context/ContextValueTypedAsAny.invalid.ts:4:17 - error: Unknown GraphQL type. Grats does not know how to map this type to a GraphQL type. You may want to define a named GraphQL type elsewhere and reference it here. If you think Grats should be able to infer a GraphQL type from this type, please file an issue.

If you think Grats should be able to infer this type, please report an issue at https://github.com/captbaritone/grats/issues.

4   greeting(ctx: any): string {
                  ~~~
```