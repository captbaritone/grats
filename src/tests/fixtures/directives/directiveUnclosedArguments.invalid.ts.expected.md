# directives/directiveUnclosedArguments.invalid.ts

## Input

```ts title="directives/directiveUnclosedArguments.invalid.ts"
// The tag ends before the arguments do, so the error is reported at the tag.

/**
 * @gqlQueryField
 * @gqlAnnotate myDirective(someArg: "oops"
 */
export function myQueryField(): string {
  return "myQueryField";
}
```

## Output

### Error Report

```text
src/tests/fixtures/directives/directiveUnclosedArguments.invalid.ts:5:4 - error: Syntax Error: Expected Name, found <EOF>.

5  * @gqlAnnotate myDirective(someArg: "oops"
     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
6  */
  ~
```