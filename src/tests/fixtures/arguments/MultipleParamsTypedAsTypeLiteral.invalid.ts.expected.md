## input

```ts title="arguments/MultipleParamsTypedAsTypeLiteral.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args: { greeting: string }, alsoArgs: { farewell: string }): string {
    return "Hello world!";
  }
}
```

## Output

```
src/tests/fixtures/arguments/MultipleParamsTypedAsTypeLiteral.invalid.ts:4:37 - error: Unexpected multiple resolver parameters typed with an object literal. Grats assumes a resolver parameter typed with object literals describes the GraphQL arguments. Therefore only one such parameter is permitted.

4   hello(args: { greeting: string }, alsoArgs: { farewell: string }): string {
                                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  src/tests/fixtures/arguments/MultipleParamsTypedAsTypeLiteral.invalid.ts:4:9
    4   hello(args: { greeting: string }, alsoArgs: { farewell: string }): string {
              ~~~~~~~~~~~~~~~~~~~~~~~~~~
    Previous type literal
```