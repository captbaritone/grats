# directives/directiveArgFieldInvalid.invalid.ts

## Input

```ts title="directives/directiveArgFieldInvalid.invalid.ts"
/**
 * @gqlInput
 */
type MyInput = { a: string };
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function customDirective(args: { foo: MyInput }) {}

/**
 * @gqlQueryField
 * @gqlAnnotate customDirective(foo: {a: 10})
 */
export function myQueryField(): string {
  return "myQueryField";
}
```

## Output

### Error Report

```text
src/tests/fixtures/directives/directiveArgFieldInvalid.invalid.ts:13:42 - error: String cannot represent a non string value: 10

13  * @gqlAnnotate customDirective(foo: {a: 10})
                                            ~~

  src/tests/fixtures/directives/directiveArgFieldInvalid.invalid.ts:4:1
    4 type MyInput = { a: string };
      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Parent input type defined here
```