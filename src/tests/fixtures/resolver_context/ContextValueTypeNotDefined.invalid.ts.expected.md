## input

```ts title="resolver_context/ContextValueTypeNotDefined.invalid.ts"
/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: ThisIsNeverDefined): string {
    return ctx.greeting;
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/resolver_context/ContextValueTypeNotDefined.invalid.ts:4:17 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

4   greeting(ctx: ThisIsNeverDefined): string {
                  ~~~~~~~~~~~~~~~~~~
```