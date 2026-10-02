# directives/directiveArgInvalidMultiline.invalid.ts

## Input

```ts title="directives/directiveArgInvalidMultiline.invalid.ts"
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(args: { foo: string; bar: string }) {}

/**
 * @gqlQueryField
 * @gqlAnnotate customDirective(
 *   foo: "foo",
 *   bar: 10
 * )
 */
export function myQueryField(): string {
  return "myQueryField";
}
```

## Output

### Error Report

```text
src/tests/fixtures/directives/directiveArgInvalidMultiline.invalid.ts:11:11 - error: String cannot represent a non string value: 10

11  *   bar: 10
             ~~
```