## input

```ts title="configOptions/multipleInvalidKeys.invalid.ts"
// {"invalidKey": "Oops", "anotherInvalidKey": "Oops"}
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