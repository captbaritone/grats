## input

```ts title="arguments/PromiseArgument.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args: { greeting: Promise<string> }): string {
    return `${args.greeting} world!`;
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/arguments/PromiseArgument.invalid.ts:4:27 - error: `Promise` is not a valid as an input type.

4   hello(args: { greeting: Promise<string> }): string {
                            ~~~~~~~~~~~~~~~
```