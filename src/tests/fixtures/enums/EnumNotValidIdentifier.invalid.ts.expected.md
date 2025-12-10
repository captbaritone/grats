-----------------
INPUT
----------------- 
/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlEnum */
export enum Enum {
  VALID = "VALID",
  INVALID = "NOT AT ALL VALID",
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/enums/EnumNotValidIdentifier.invalid.ts:10:13 - error: Names must only contain [_a-zA-Z0-9] but "NOT AT ALL VALID" does not.

10   INVALID = "NOT AT ALL VALID",
               ~~~~~~~~~~~~~~~~~~
