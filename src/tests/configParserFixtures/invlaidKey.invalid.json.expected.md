# invlaidKey.invalid.json

## Input

```json title="invlaidKey.invalid.json"
{
  "lol": true
}
```

## Output

### Error Report

```text
config.json:2:3 - error: Invalid Grats config: lol: unknown field `lol`, expected one of `graphqlSchema`, `tsSchema`, `tsClientEnums`, `nullableByDefault`, `strictSemanticNullability`, `schemaHeader`, `tsSchemaHeader`, `tsClientEnumsHeader`, `importModuleSpecifierEnding`, `EXPERIMENTAL__emitMetadata`, `EXPERIMENTAL__emitResolverMap`

2   "lol": true
    ~~~~~~~~~~~
```