# directives/defineCustomDirectiveOnIsNotString.invalid.ts

## Input

```ts title="directives/defineCustomDirectiveOnIsNotString.invalid.ts"
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION This is a description with {@link https://example.com some link}
 * and `inline code` to demonstrate structured comments.
 */
function customDirective() {}
```

## Output

### Error Report

```text
src/tests/fixtures/directives/defineCustomDirectiveOnIsNotString.invalid.ts:3:65 - error: Expected Grats JSDoc tag value to be simple text.

3  * @gqlDirective on FIELD_DEFINITION This is a description with {@link https://example.com some link}
                                                                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```