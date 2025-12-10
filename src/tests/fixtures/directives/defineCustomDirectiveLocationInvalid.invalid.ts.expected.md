## input

```ts title="directives/defineCustomDirectiveLocationInvalid.invalid.ts"
/**
 * This is my custom directive.
 * @gqlDirective on WHOOPS
 */
export function customDirective() {}
```

## Output

### Error Report

```text
src/tests/fixtures/directives/defineCustomDirectiveLocationInvalid.invalid.ts:3:4 - error: Syntax Error: Unexpected Name "WHOOPS".

3  * @gqlDirective on WHOOPS
     ~~~~~~~~~~~~~~~~~~~~~~~
4  */
  ~
```