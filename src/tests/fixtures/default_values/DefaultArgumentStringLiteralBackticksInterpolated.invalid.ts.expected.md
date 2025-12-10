## input

```ts title="default_values/DefaultArgumentStringLiteralBackticksInterpolated.invalid.ts"
const CONSTANT = "constant";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting = `hello ${CONSTANT}` }: { greeting: string }): string {
    return `${greeting} world!`;
  }
}
```

## Output

```
src/tests/fixtures/default_values/DefaultArgumentStringLiteralBackticksInterpolated.invalid.ts:6:22 - error: Expected GraphQL field argument default values to be a literal. Grats interprets argument defaults as GraphQL default values, which must be literals. For example: `10` or `"foo"`.

If you think Grats should be able to infer this constant value, please report an issue at https://github.com/captbaritone/grats/issues.

6   hello({ greeting = `hello ${CONSTANT}` }: { greeting: string }): string {
                       ~~~~~~~~~~~~~~~~~~~
```