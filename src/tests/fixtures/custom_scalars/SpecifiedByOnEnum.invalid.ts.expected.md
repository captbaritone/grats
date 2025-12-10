-----------------
INPUT
----------------- 
/**
 * @gqlEnum
 * @gqlAnnotate specifiedBy(url: "https://tools.ietf.org/html/rfc4122")
 */
export type MyEnum = "A" | "B" | "C";

-----------------
OUTPUT
-----------------
src/tests/fixtures/custom_scalars/SpecifiedByOnEnum.invalid.ts:3:4 - error: Directive "@specifiedBy" may not be used on ENUM.

3  * @gqlAnnotate specifiedBy(url: "https://tools.ietf.org/html/rfc4122")
     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
4  */
  ~
