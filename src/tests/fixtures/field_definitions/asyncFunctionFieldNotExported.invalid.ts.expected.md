# field_definitions/asyncFunctionFieldNotExported.invalid.ts

## Input

```ts title="field_definitions/asyncFunctionFieldNotExported.invalid.ts"
/** @gqlField */
async function greet(_: Query): Promise<string> {
  return "Hello, World!";
}

/** @gqlType */
type Query = unknown;
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/asyncFunctionFieldNotExported.invalid.ts:2:16 - error: Expected a `@gqlField` function to be a named export. Grats needs to import resolver functions into its generated schema module, so the resolver function must be a named export.

2 async function greet(_: Query): Promise<string> {
                 ~~~~~
```

#### Code Action: "Add export keyword to function with @gqlField" (add-export-keyword-to-function)

```diff
- Original
+ Fixed

@@ -1,3 +1,3 @@
  /** @gqlField */
- async function greet(_: Query): Promise<string> {
+ export async function greet(_: Query): Promise<string> {
    return "Hello, World!";
```

#### Applied Fixes

```text
  * Applied fix "Add export keyword to function with @gqlField" in grats/src/tests/fixtures/field_definitions/asyncFunctionFieldNotExported.invalid.ts
```

#### Fixed Text

```typescript
/** @gqlField */
export async function greet(_: Query): Promise<string> {
  return "Hello, World!";
}

/** @gqlType */
type Query = unknown;
```