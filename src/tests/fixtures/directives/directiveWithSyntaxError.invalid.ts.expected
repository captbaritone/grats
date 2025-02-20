-----------------
INPUT
----------------- 
// Because @myDirective is followed by `(` we assume it's expected to be parsed
// as a directive even though it's not defined.

/**
 * @gqlQueryField
 * @gqlAnnotate myDirective(someArg: --oops)
 */
export function myQueryField(): string {
  return "myQueryField";
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/directives/directiveWithSyntaxError.invalid.ts:6:4 - error: Syntax Error: Invalid number, expected digit but got: "-".

6  * @gqlAnnotate myDirective(someArg: --oops)
     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
7  */
  ~
