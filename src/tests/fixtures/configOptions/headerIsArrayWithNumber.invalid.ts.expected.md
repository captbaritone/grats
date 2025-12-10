## input

```ts title="configOptions/headerIsArrayWithNumber.invalid.ts"
// {"schemaHeader": ["Hello", 1]}
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}
```

## Output

```
error: Expected property `schemaHeader` to be a string or array of strings, but got ["Hello",1].
```