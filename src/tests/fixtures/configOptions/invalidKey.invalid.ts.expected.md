# configOptions/invalidKey.invalid.ts

## Input

```ts title="configOptions/invalidKey.invalid.ts"
// {"invalidKey": "Oops"}
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}
```

## Output

### Error Report

```text
error: Unknown Grats config option `invalidKey`.
```