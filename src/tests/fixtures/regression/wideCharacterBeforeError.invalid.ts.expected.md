# regression/wideCharacterBeforeError.invalid.ts

## Input

```ts title="regression/wideCharacterBeforeError.invalid.ts"
// A diagnostic inside a docblock is reported at offsets the GraphQL lexer
// counts in UTF-8 bytes, which Grats converts to the UTF-16 ones editors use.
// The wide characters before the error are what tell the two apart.

/**
 * @gqlQueryField
 * @gqlAnnotate myDirective(greeting: "héllo 🌍", someArg: --oops)
 */
export function myQueryField(): string {
  return "myQueryField";
}
```

## Output

### Error Report

```text
src/tests/fixtures/regression/wideCharacterBeforeError.invalid.ts:7:61 - error: Syntax Error: Invalid number, expected digit but got: "-".

7  * @gqlAnnotate myDirective(greeting: "héllo 🌍", someArg: --oops)
                                                              ~
```