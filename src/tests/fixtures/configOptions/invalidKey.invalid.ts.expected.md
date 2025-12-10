## input

```ts title="configOptions/invalidKey.invalid.ts"
// {"invalidKey": "Oops"}
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}
```

## Output

```
error: Unknown Grats config option `invalidKey`.
```