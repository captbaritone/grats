# default_values/DefaultArgumentObjectLiteralInterpolation.invalid.ts

## Input

```ts title="default_values/DefaultArgumentObjectLiteralInterpolation.invalid.ts"
import { Int } from "../../../Types";

const first = 10;
const offset = 100;
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({
    input = { first, offset },
  }: {
    input?: ConnectionInput | null;
  }): string {
    return "hello";
  }
}

/** @gqlInput */
type ConnectionInput = {
  first: Int;
  offset: Int;
};
```

## Output

### Error Report

```text
src/tests/fixtures/default_values/DefaultArgumentObjectLiteralInterpolation.invalid.ts:9:15 - error: Expected property to be a default assignment. For example: `{ first = 10}`. Grats needs to extract a literal GraphQL value here, and that requires Grats being able to see the literal value in the source code.

If you think Grats should be able to infer this constant value, please report an issue at https://github.com/captbaritone/grats/issues.

9     input = { first, offset },
                ~~~~~
src/tests/fixtures/default_values/DefaultArgumentObjectLiteralInterpolation.invalid.ts:9:22 - error: Expected property to be a default assignment. For example: `{ first = 10}`. Grats needs to extract a literal GraphQL value here, and that requires Grats being able to see the literal value in the source code.

If you think Grats should be able to infer this constant value, please report an issue at https://github.com/captbaritone/grats/issues.

9     input = { first, offset },
                       ~~~~~~
```