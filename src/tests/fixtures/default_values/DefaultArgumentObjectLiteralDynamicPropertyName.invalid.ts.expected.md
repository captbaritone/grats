# default_values/DefaultArgumentObjectLiteralDynamicPropertyName.invalid.ts

## Input

```ts title="default_values/DefaultArgumentObjectLiteralDynamicPropertyName.invalid.ts"
import { Int } from "../../../Types";

const x = "first";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({
    input = { [x]: 10, offset: 100 },
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
src/tests/fixtures/default_values/DefaultArgumentObjectLiteralDynamicPropertyName.invalid.ts:9:15 - error: Expected a name identifier. Grats expected to find a name here which it could use to derive the GraphQL name.

9     input = { [x]: 10, offset: 100 },
                ~~~
```