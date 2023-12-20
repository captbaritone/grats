-----------------
INPUT
----------------- 
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting: { foo: string; bar: string } }): string {
    return "Hello world!";
  }
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/arguments/ObjectLiteralArgument.invalid.ts:4:35 - error: Unexpected type literal. Grats expects types in GraphQL positions to be scalar types, or reference a named GraphQL type directly. You may want to define a named GraphQL type elsewhere and reference it here.

4   hello({ greeting }: { greeting: { foo: string; bar: string } }): string {
                                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
