## input

```ts title="directives/undefinedDirectiveWithArgs.invalid.ts"
/**
 * @gqlQueryField
 * @gqlAnnotate myDirective(someArg: "someValue")
 */
export function myQueryField(): string {
  return "myQueryField";
}
```

## Output

### Error Report

```text
src/tests/fixtures/directives/undefinedDirectiveWithArgs.invalid.ts:3:4 - error: Unknown directive "@myDirective".

3  * @gqlAnnotate myDirective(someArg: "someValue")
     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
4  */
  ~
```