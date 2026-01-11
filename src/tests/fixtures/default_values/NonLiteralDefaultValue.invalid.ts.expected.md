# default_values/NonLiteralDefaultValue.invalid.ts

## Input

```ts title="default_values/NonLiteralDefaultValue.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting = String(Math.random()) }: { greeting: string }): string {
    return `${greeting} world!`;
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/default_values/NonLiteralDefaultValue.invalid.ts:4:22 - error: Expected GraphQL field argument default values to be a literal. Grats interprets argument defaults as GraphQL default values, which must be literals. For example: `10` or `"foo"`.

If you think Grats should be able to infer this constant value, please report an issue at https://github.com/captbaritone/grats/issues.

4   hello({ greeting = String(Math.random()) }: { greeting: string }): string {
                       ~~~~~~~~~~~~~~~~~~~~~
```