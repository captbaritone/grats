## input

```ts title="arguments/TupleLiteralArgument.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting: [string] }): string {
    return "Hello world!";
  }
}
```

## Output

```
src/tests/fixtures/arguments/TupleLiteralArgument.invalid.ts:4:35 - error: Unknown GraphQL type. Grats does not know how to map this type to a GraphQL type. You may want to define a named GraphQL type elsewhere and reference it here. If you think Grats should be able to infer a GraphQL type from this type, please file an issue.

If you think Grats should be able to infer this type, please report an issue at https://github.com/captbaritone/grats/issues.

4   hello({ greeting }: { greeting: [string] }): string {
                                    ~~~~~~~~
```