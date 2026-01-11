# custom_scalars/SpecifiedByOnEnum.invalid.ts

## Input

```ts title="custom_scalars/SpecifiedByOnEnum.invalid.ts"
/**
 * @gqlEnum
 * @gqlAnnotate specifiedBy(url: "https://tools.ietf.org/html/rfc4122")
 */
export type MyEnum = "A" | "B" | "C";
```

## Output

### Error Report

```text
src/tests/fixtures/custom_scalars/SpecifiedByOnEnum.invalid.ts:3:4 - error: Directive "@specifiedBy" may not be used on ENUM.

3  * @gqlAnnotate specifiedBy(url: "https://tools.ietf.org/html/rfc4122")
     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
4  */
  ~
```