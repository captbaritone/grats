# configOptions/nonNullableIsNull.invalid.ts

## Input

```ts title="configOptions/nonNullableIsNull.invalid.ts"
// {"tsSchema": null}
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}
```

## Output

### Error Report

```text
error: Invalid Grats config: tsSchema: invalid type: null, expected a string
```