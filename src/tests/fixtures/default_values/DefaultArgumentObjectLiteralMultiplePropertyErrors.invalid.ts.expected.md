-----------------
INPUT
----------------- 
import { Int } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({
    input = { first: func(), offset: func() },
  }: {
    input?: ConnectionInput | null;
  }): string {
    return "hello";
  }
}

function func() {
  return 10;
}

/** @gqlInput */
type ConnectionInput = {
  first: Int;
  offset: Int;
};

-----------------
OUTPUT
-----------------
src/tests/fixtures/default_values/DefaultArgumentObjectLiteralMultiplePropertyErrors.invalid.ts:7:22 - error: Expected GraphQL field argument default values to be a literal. Grats interprets argument defaults as GraphQL default values, which must be literals. For example: `10` or `"foo"`.

If you think Grats should be able to infer this constant value, please report an issue at https://github.com/captbaritone/grats/issues.

7     input = { first: func(), offset: func() },
                       ~~~~~~
src/tests/fixtures/default_values/DefaultArgumentObjectLiteralMultiplePropertyErrors.invalid.ts:7:38 - error: Expected GraphQL field argument default values to be a literal. Grats interprets argument defaults as GraphQL default values, which must be literals. For example: `10` or `"foo"`.

If you think Grats should be able to infer this constant value, please report an issue at https://github.com/captbaritone/grats/issues.

7     input = { first: func(), offset: func() },
                                       ~~~~~~
