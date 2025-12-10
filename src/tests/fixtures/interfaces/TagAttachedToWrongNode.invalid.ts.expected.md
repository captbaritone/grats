-----------------
INPUT
----------------- 
/** @gqlInterface Person */
function Foo() {}

-----------------
OUTPUT
-----------------
src/tests/fixtures/interfaces/TagAttachedToWrongNode.invalid.ts:1:5 - error: `@gqlInterface` can only be used on interface declarations. e.g. `interface MyInterface {}`

1 /** @gqlInterface Person */
      ~~~~~~~~~~~~~~~~~~~~~
