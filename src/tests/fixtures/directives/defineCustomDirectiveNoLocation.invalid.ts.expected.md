## input

```ts title="directives/defineCustomDirectiveNoLocation.invalid.ts"
/**
 * This is my custom directive.
 * @gqlDirective
 */
function customDirective() {}
```

## Output

```
src/tests/fixtures/directives/defineCustomDirectiveNoLocation.invalid.ts:3:4 - error: Expected `@gqlDirective` tag to specify at least one location.

3  * @gqlDirective
     ~~~~~~~~~~~~~
4  */
  ~
```