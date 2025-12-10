## input

```ts title="arguments/DeprecatedRequiredArgument.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({
    greeting,
  }: {
    /** @deprecated Not used anymore */
    greeting: string;
  }): string {
    return "Hello world!";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/arguments/DeprecatedRequiredArgument.invalid.ts:7:10 - error: Required argument SomeType.hello(greeting:) cannot be deprecated.

7     /** @deprecated Not used anymore */
           ~~~~~~~~~~

  src/tests/fixtures/arguments/DeprecatedRequiredArgument.invalid.ts:8:15
    8     greeting: string;
                    ~~~~~~
    Related location
```