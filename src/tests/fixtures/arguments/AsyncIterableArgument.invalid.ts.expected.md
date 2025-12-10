## input

```ts title="arguments/AsyncIterableArgument.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args: { greeting: AsyncIterable<string> }): string {
    return `${args.greeting} world!`;
  }
}
```

## Output

```
src/tests/fixtures/arguments/AsyncIterableArgument.invalid.ts:4:27 - error: `AsyncIterable` is not a valid as an input type.

4   hello(args: { greeting: AsyncIterable<string> }): string {
                            ~~~~~~~~~~~~~~~~~~~~~
```