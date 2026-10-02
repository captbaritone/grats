# configOptions/multipleInvalidKeys.invalid.ts

## Input

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
error: Invalid Grats config: invalidKey: unknown field `invalidKey`, expected one of `graphqlSchema`, `tsSchema`, `tsClientEnums`, `nullableByDefault`, `strictSemanticNullability`, `schemaHeader`, `tsSchemaHeader`, `tsClientEnumsHeader`, `importModuleSpecifierEnding`, `EXPERIMENTAL__emitMetadata`, `EXPERIMENTAL__emitResolverMap`
```