# resolver_context/ClassMethodWithContextValueInArgsPos.invalid.ts

## Input

```ts title="resolver_context/ClassMethodWithContextValueInArgsPos.invalid.ts"
type GratsContext = {
  greeting: string;
};

/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: GratsContext): string {
    return ctx.greeting;
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/resolver_context/ClassMethodWithContextValueInArgsPos.invalid.ts:8:17 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

8   greeting(ctx: GratsContext): string {
                  ~~~~~~~~~~~~
```