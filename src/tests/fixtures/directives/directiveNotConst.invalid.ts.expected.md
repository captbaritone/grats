## input

```ts title="directives/directiveNotConst.invalid.ts"
// Because @myDirective is followed by `(` we assume it's expected to be parsed
// as a directive even though it's not defined.

/**
 * @gqlQueryField
 * @gqlAnnotate myDirective(someArg: $foo)
 */
export function myQueryField(): string {
  return "myQueryField";
}
```

## Output

```
src/tests/fixtures/directives/directiveNotConst.invalid.ts:6:4 - error: Syntax Error: Unexpected variable "$foo" in constant value.

6  * @gqlAnnotate myDirective(someArg: $foo)
     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
7  */
  ~
```