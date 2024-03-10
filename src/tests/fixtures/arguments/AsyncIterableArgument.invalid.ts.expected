-----------------
INPUT
----------------- 
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args: { greeting: AsyncIterable<string> }): string {
    return `${args.greeting} world!`;
  }
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/arguments/AsyncIterableArgument.invalid.ts:4:27 - error: `AsyncIterable` is not a valid as an input type.

4   hello(args: { greeting: AsyncIterable<string> }): string {
                            ~~~~~~~~~~~~~~~~~~~~~
