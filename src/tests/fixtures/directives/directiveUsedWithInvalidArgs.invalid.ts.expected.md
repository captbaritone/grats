## input

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

```
GraphQL request:1:23 - error: String cannot represent a non string value: 10

1 @customDirective(foo: 10)
                        ~~
```