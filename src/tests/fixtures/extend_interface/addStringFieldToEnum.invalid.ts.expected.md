-----------------
INPUT
----------------- 
/** @gqlEnum */
type MyEnum = "Foo" | "Bar";

/** @gqlField */
export function greeting(myEnum: MyEnum): string {
  return `Hello ${myEnum}!`;
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/extend_interface/addStringFieldToEnum.invalid.ts:5:34 - error: Unexpected type passed to `@gqlField` function. `@gqlField` functions can only be used to extend `@gqlType` and `@gqlInterface` types.

5 export function greeting(myEnum: MyEnum): string {
                                   ~~~~~~

  src/tests/fixtures/extend_interface/addStringFieldToEnum.invalid.ts:2:6
    2 type MyEnum = "Foo" | "Bar";
           ~~~~~~
    This is the type that was passed to `@gqlField`.
