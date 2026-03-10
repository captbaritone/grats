# enums/EnumNotExportedWithEmitEnumsConfig.invalid.ts

## Input

```ts title="enums/EnumNotExportedWithEmitEnumsConfig.invalid.ts"
// {"tsClientEnums": "enums.ts"}

/** @gqlEnum */
enum Color {
  RED = "red",
  GREEN = "green",
  BLUE = "blue",
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function favoriteColor(_: Query): Color {
  return Color.RED;
}
```

## Output

### Error Report

```text
src/tests/fixtures/enums/EnumNotExportedWithEmitEnumsConfig.invalid.ts:4:1 - error: Expected enum to be exported when `tsClientEnums` is configured. Grats needs to import enum types to build the enums module.

  4 enum Color {
    ~~~~~~~~~~~~
  5   RED = "red",
    ~~~~~~~~~~~~~~
... 
  7   BLUE = "blue",
    ~~~~~~~~~~~~~~~~
  8 }
    ~
```

#### Code Action: "Add export keyword to enum with @gqlEnum" (add-export-keyword-to-enum)

```diff
- Original
+ Fixed

@@ -3,3 +3,3 @@
  /** @gqlEnum */
- enum Color {
+ export enum Color {
    RED = "red",
```

#### Applied Fixes

```text
  * Applied fix "Add export keyword to enum with @gqlEnum" in grats/src/tests/fixtures/enums/EnumNotExportedWithEmitEnumsConfig.invalid.ts
```

#### Fixed Text

```typescript
// {"tsClientEnums": "enums.ts"}

/** @gqlEnum */
export enum Color {
  RED = "red",
  GREEN = "green",
  BLUE = "blue",
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function favoriteColor(_: Query): Color {
  return Color.RED;
}
```