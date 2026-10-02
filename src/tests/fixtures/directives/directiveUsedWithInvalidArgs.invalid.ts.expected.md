# directives/directiveUsedWithInvalidArgs.invalid.ts

## Input

```ts title="directives/directiveUsedWithInvalidArgs.invalid.ts"
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(args: { foo: string }) {}

/**
 * @gqlQueryField
 * @gqlAnnotate customDirective(foo: 10)
 */
export function myQueryField(): string {
  return "myQueryField";
}
```

## Output

### Error Report

```text
src/tests/fixtures/directives/directiveUsedWithInvalidArgs.invalid.ts:9:38 - error: String cannot represent a non string value: 10

9  * @gqlAnnotate customDirective(foo: 10)
                                       ~~
```