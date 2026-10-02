# directives/directiveUsedWithUnknownArg.invalid.ts

## Input

```ts title="directives/directiveUsedWithUnknownArg.invalid.ts"
/**
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(args: { foo: string }) {}

/**
 * @gqlQueryField
 * @gqlAnnotate customDirective(foo: "a", bar: "b")
 */
export function myQueryField(): string {
  return "myQueryField";
}
```

## Output

### Error Report

```text
src/tests/fixtures/directives/directiveUsedWithUnknownArg.invalid.ts:8:43 - error: Unknown argument "bar" on directive "@customDirective".

8  * @gqlAnnotate customDirective(foo: "a", bar: "b")
                                            ~~~~~~~~
```