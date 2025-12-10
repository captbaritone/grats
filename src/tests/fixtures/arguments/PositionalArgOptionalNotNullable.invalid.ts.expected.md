## input

```ts title="arguments/PositionalArgOptionalNotNullable.invalid.ts"
/** @gqlInput */
type Greeting = {
  name: string;
  salutation: string;
};

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greeting?: string): string {
    return `${greeting ?? "Hello"} World`;
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/arguments/PositionalArgOptionalNotNullable.invalid.ts:10:17 - error: Unexpected optional argument that does not also accept `null`. Optional arguments in GraphQL may get passed an explicit `null` value by the GraphQL executor. This means optional arguments must be typed to also accept `null`. Consider adding `| null` to the end of the argument type.

10   hello(greeting?: string): string {
                   ~
```

#### Code Action: "Add '| null' to the parameter type" (add-null-to-optional-parameter-type)

```diff
- Original
+ Fixed

@@ -9,3 +9,3 @@
    /** @gqlField */
-   hello(greeting?: string): string {
+   hello(greeting?: string | null): string {
      return `${greeting ?? "Hello"} World`;
```

#### Applied Fixes

```text
  * Applied fix "Add '| null' to the parameter type" in grats/src/tests/fixtures/arguments/PositionalArgOptionalNotNullable.invalid.ts
```

#### Fixed Text

```typescript
/** @gqlInput */
type Greeting = {
  name: string;
  salutation: string;
};

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greeting?: string | null): string {
    return `${greeting ?? "Hello"} World`;
  }
}
```