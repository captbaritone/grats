## input

```ts title="field_definitions/FieldDefinedOnNonGqlType.invalid.ts"
class Foo {
  /** @gqlField */
  field: string;
}
```

## Output

```
src/tests/fixtures/field_definitions/FieldDefinedOnNonGqlType.invalid.ts:2:8 - error: Unexpected `@gqlField`. The parent construct must be either a `@gqlType` or `@gqlInterface` tag. Are you missing one of these tags?

2   /** @gqlField */
         ~~~~~~~~
```