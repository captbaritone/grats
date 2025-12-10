-----------------
INPUT
----------------- 
/** @gqlScalar Matrix */
function Foo() {}

-----------------
OUTPUT
-----------------
src/tests/fixtures/custom_scalars/TagAttachedToWrongNode.invalid.ts:1:5 - error: `@gqlScalar` can only be used on type alias declarations. e.g. `type MyScalar = string`

1 /** @gqlScalar Matrix */
      ~~~~~~~~~~~~~~~~~~
