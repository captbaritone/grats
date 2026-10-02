# arguments/LiteralNullAndTemplateTypes.invalid.ts

## Input

```ts title="arguments/LiteralNullAndTemplateTypes.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  nullArg(arg: null): string {
    return "";
  }

  /** @gqlField */
  templateArg(arg: `hello`): string {
    return "";
  }

  /** @gqlField */
  substitutionArg(arg: `hello ${string}`): string {
    return "";
  }

  /** @gqlField */
  nullField: null;

  /** @gqlField */
  templateField: `hello`;
}
```

## Output

### Error Report

```text
src/tests/fixtures/arguments/LiteralNullAndTemplateTypes.invalid.ts:4:16 - error: Literal types like `true`, `"hello"`, or `42` cannot be used in GraphQL input positions (e.g., field arguments). GraphQL has no way to enforce that only this specific value is passed. Use the broader type (`Boolean`, `String`, `Int`, etc.) instead.

4   nullArg(arg: null): string {
                 ~~~~
src/tests/fixtures/arguments/LiteralNullAndTemplateTypes.invalid.ts:9:20 - error: Literal types like `true`, `"hello"`, or `42` cannot be used in GraphQL input positions (e.g., field arguments). GraphQL has no way to enforce that only this specific value is passed. Use the broader type (`Boolean`, `String`, `Int`, etc.) instead.

9   templateArg(arg: `hello`): string {
                     ~~~~~~~
src/tests/fixtures/arguments/LiteralNullAndTemplateTypes.invalid.ts:14:24 - error: Unknown GraphQL type. Grats does not know how to map this type to a GraphQL type. You may want to define a named GraphQL type elsewhere and reference it here. If you think Grats should be able to infer a GraphQL type from this type, please file an issue.

If you think Grats should be able to infer this type, please report an issue at https://github.com/captbaritone/grats/issues.

14   substitutionArg(arg: `hello ${string}`): string {
                          ~~~~~~~~~~~~~~~~~
src/tests/fixtures/arguments/LiteralNullAndTemplateTypes.invalid.ts:19:14 - error: Unknown GraphQL type. Grats does not know how to map this type to a GraphQL type. You may want to define a named GraphQL type elsewhere and reference it here. If you think Grats should be able to infer a GraphQL type from this type, please file an issue.

If you think Grats should be able to infer this type, please report an issue at https://github.com/captbaritone/grats/issues.

19   nullField: null;
                ~~~~
src/tests/fixtures/arguments/LiteralNullAndTemplateTypes.invalid.ts:22:18 - error: Unknown GraphQL type. Grats does not know how to map this type to a GraphQL type. You may want to define a named GraphQL type elsewhere and reference it here. If you think Grats should be able to infer a GraphQL type from this type, please file an issue.

If you think Grats should be able to infer this type, please report an issue at https://github.com/captbaritone/grats/issues.

22   templateField: `hello`;
                    ~~~~~~~
```