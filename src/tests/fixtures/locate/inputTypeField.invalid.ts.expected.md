-----------------
INPUT
----------------- 
// Locate: User.name
/** @gqlInput */
type User = {
  name: string;
};

-----------------
OUTPUT
-----------------
src/tests/fixtures/locate/inputTypeField.invalid.ts:4:3 - error: Located here

4   name: string;
    ~~~~
