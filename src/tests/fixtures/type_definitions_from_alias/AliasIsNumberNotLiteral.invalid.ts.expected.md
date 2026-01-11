# type_definitions_from_alias/AliasIsNumberNotLiteral.invalid.ts

## Input

```ts title="type_definitions_from_alias/AliasIsNumberNotLiteral.invalid.ts"
/** @gqlType */
export type SomeType = 10;
```

## Output

### Error Report

```text
src/tests/fixtures/type_definitions_from_alias/AliasIsNumberNotLiteral.invalid.ts:2:24 - error: Expected `@gqlType` type to be an object type literal (`{ }`) or `unknown`. For example: `type Foo = { bar: string }` or `type Query = unknown`.

2 export type SomeType = 10;
                         ~~
```