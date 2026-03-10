# locate/enumValue.invalid.ts

## Input

```ts title="locate/enumValue.invalid.ts"
// Locate: Greeting.HELLO
/** @gqlEnum */
export enum Greeting {
  HELLO = "HELLO",
  GOODBYE = "GOODBYE",
}
```

## Output

### Error Report

```text
src/tests/fixtures/locate/enumValue.invalid.ts:4:11 - error: Located here

4   HELLO = "HELLO",
            ~~~~~~~
```