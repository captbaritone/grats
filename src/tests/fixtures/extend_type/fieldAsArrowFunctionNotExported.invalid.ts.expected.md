# extend_type/fieldAsArrowFunctionNotExported.invalid.ts

## Input

```ts title="extend_type/fieldAsArrowFunctionNotExported.invalid.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
const greeting = (_: SomeType): string => {
  return `Hello World`;
};
```

## Output

### Error Report

```text
src/tests/fixtures/extend_type/fieldAsArrowFunctionNotExported.invalid.ts:7:7 - error: Expected `@gqlField` to be an exported top-level declaration. Grats needs to import resolver functions into its generated schema module, so the resolver function must be exported from the module.

7 const greeting = (_: SomeType): string => {
        ~~~~~~~~
```

#### Code Action: "Add export keyword to exported arrow function with @gqlField" (add-export-keyword-to-arrow-function)

```diff
- Original
+ Fixed

@@ -6,3 +6,3 @@
  /** @gqlField */
- const greeting = (_: SomeType): string => {
+ export const greeting = (_: SomeType): string => {
    return `Hello World`;
```

#### Applied Fixes

```text
  * Applied fix "Add export keyword to exported arrow function with @gqlField" in grats/src/tests/fixtures/extend_type/fieldAsArrowFunctionNotExported.invalid.ts
```

#### Fixed Text

```typescript
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export const greeting = (_: SomeType): string => {
  return `Hello World`;
};
```