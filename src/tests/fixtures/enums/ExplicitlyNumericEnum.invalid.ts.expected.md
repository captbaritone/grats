## input

```ts title="enums/ExplicitlyNumericEnum.invalid.ts"
/** @gqlEnum */
enum Enum {
  VALID = 1,
  INVALID = 2,
}
```

## Output

```
src/tests/fixtures/enums/ExplicitlyNumericEnum.invalid.ts:3:3 - error: Expected `@gqlEnum` enum members to have string literal initializers. For example: `FOO = 'foo'`. In GraphQL enum values are strings, and Grats needs to be able to see the concrete value of the enum member to generate the GraphQL schema.

If you think Grats should be able to infer this enum value, please report an issue at https://github.com/captbaritone/grats/issues.

3   VALID = 1,
    ~~~~~~~~~
src/tests/fixtures/enums/ExplicitlyNumericEnum.invalid.ts:4:3 - error: Expected `@gqlEnum` enum members to have string literal initializers. For example: `FOO = 'foo'`. In GraphQL enum values are strings, and Grats needs to be able to see the concrete value of the enum member to generate the GraphQL schema.

If you think Grats should be able to infer this enum value, please report an issue at https://github.com/captbaritone/grats/issues.

4   INVALID = 2,
    ~~~~~~~~~~~
```