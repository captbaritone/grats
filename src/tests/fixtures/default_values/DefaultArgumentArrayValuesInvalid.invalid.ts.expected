-----------------
INPUT
----------------- 
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({
    inputs = [func(), func()],
  }: {
    inputs?: string[] | null;
  }): string {
    if (inputs === null) {
      return "got null";
    }
    return inputs.join("|");
  }
}

function func(): string {
  return "sup";
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/default_values/DefaultArgumentArrayValuesInvalid.invalid.ts:5:15 - error: Expected GraphQL field argument default values to be a literal. Grats interprets argument defaults as GraphQL default values, which must be literals. For example: `10` or `"foo"`.

If you think Grats should be able to infer this constant value, please report an issue at https://github.com/captbaritone/grats/issues.

5     inputs = [func(), func()],
                ~~~~~~
src/tests/fixtures/default_values/DefaultArgumentArrayValuesInvalid.invalid.ts:5:23 - error: Expected GraphQL field argument default values to be a literal. Grats interprets argument defaults as GraphQL default values, which must be literals. For example: `10` or `"foo"`.

If you think Grats should be able to infer this constant value, please report an issue at https://github.com/captbaritone/grats/issues.

5     inputs = [func(), func()],
                        ~~~~~~
