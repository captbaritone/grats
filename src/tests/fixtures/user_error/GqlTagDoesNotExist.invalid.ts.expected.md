## input

```ts title="user_error/GqlTagDoesNotExist.invalid.ts"
/** @gqlFiled */
```

## Output

### Error Report

```text
src/tests/fixtures/user_error/GqlTagDoesNotExist.invalid.ts:1:6 - error: `@gqlFiled` is not a valid Grats tag. Valid tags are: `@gqlType`, `@gqlField`, `@gqlScalar`, `@gqlInterface`, `@gqlEnum`, `@gqlUnion`, `@gqlInput`, `@gqlDirective`, `@gqlAnnotate`, `@gqlQueryField`, `@gqlMutationField`, `@gqlSubscriptionField`.

1 /** @gqlFiled */
       ~~~~~~~~
```

#### Code Action: "Change to @gqlField" (change-to-gqlField)

```diff
- Original
+ Fixed

- /** @gqlFiled */
+ /** @gqlField */
```

#### Applied Fixes

```text
  * Applied fix "Change to @gqlField" in grats/src/tests/fixtures/user_error/GqlTagDoesNotExist.invalid.ts
```

#### Fixed Text

```typescript
/** @gqlField */
```