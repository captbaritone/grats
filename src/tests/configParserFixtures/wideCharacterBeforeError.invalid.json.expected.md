# wideCharacterBeforeError.invalid.json

## Input

```json title="wideCharacterBeforeError.invalid.json"
{ "schemaHeader": "héllo 🌍", "lol": true }
```

## Output

### Error Report

```text
config.json:1:31 - error: Invalid Grats config: lol: unknown field `lol`, expected one of `graphqlSchema`, `tsSchema`, `tsClientEnums`, `nullableByDefault`, `strictSemanticNullability`, `schemaHeader`, `tsSchemaHeader`, `tsClientEnumsHeader`, `importModuleSpecifierEnding`, `EXPERIMENTAL__emitMetadata`, `EXPERIMENTAL__emitResolverMap`

1 { "schemaHeader": "héllo 🌍", "lol": true }
                                ~~~~~
```