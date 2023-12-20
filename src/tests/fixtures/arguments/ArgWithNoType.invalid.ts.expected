-----------------
INPUT
----------------- 
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting }): string {
    return "Hello world!";
  }
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/arguments/ArgWithNoType.invalid.ts:4:25 - error: Expected GraphQL field argument to have an explicit type annotation. For example: `{ someField: string }`. Grats needs to be able to see the type of the arguments to generate a GraphQL schema.

4   hello({ greeting }: { greeting }): string {
                          ~~~~~~~~
