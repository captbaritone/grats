# configOptions/headerIsArrayWithNumber.invalid.ts

## Input

```ts title="configOptions/headerIsArrayWithNumber.invalid.ts"
// {"schemaHeader": ["Hello", 1]}
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}
```

## Output

### Error Report

```text
error: Invalid Grats config: schemaHeader: expected a string or an array of strings
```