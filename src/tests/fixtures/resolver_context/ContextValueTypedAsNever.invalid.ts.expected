-----------------
INPUT
----------------- 
/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(ctx: never): string {
    return ctx.greeting;
  }
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/resolver_context/ContextValueTypedAsNever.invalid.ts:4:17 - error: Unknown GraphQL type. Grats does not know how to map this type to a GraphQL type. You may want to define a named GraphQL type elsewhere and reference it here. If you think Grats should be able to infer a GraphQL type from this type, please file an issue.

If you think Grats should be able to infer this type, please report an issue at https://github.com/captbaritone/grats/issues.

4   greeting(ctx: never): string {
                  ~~~~~
