## input

```ts title="directives/defineCustomDirectiveReadsContext.invalid.ts"
/** @gqlContext */
type Ctx = {};

/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(oops: Ctx) {}
```

## Output

### Error Report

```text
src/tests/fixtures/directives/defineCustomDirectiveReadsContext.invalid.ts:8:33 - error: Expected first argument of a `@gqlDirective` function to be typed using an inline object literal.

8 export function customDirective(oops: Ctx) {}
                                  ~~~~~~~~~
```