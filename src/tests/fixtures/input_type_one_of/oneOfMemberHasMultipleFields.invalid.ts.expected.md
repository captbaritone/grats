-----------------
INPUT
----------------- 
/**
 * @gqlInput
 */
export type Greeting =
  | { firstName: string }
  | { lastName: string; nickName: string };

-----------------
OUTPUT
-----------------
src/tests/fixtures/input_type_one_of/oneOfMemberHasMultipleFields.invalid.ts:6:5 - error: Expected each member of a @oneOf @gqlInput to be a TypeScript object literal with exactly one property.

6   | { lastName: string; nickName: string };
      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
