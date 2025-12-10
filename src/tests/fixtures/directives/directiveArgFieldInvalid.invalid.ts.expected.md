-----------------
INPUT
----------------- 
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

-----------------
OUTPUT
-----------------
GraphQL request:1:27 - error: String cannot represent a non string value: 10

1 @customDirective(foo: {a: 10})
                            ~~

  src/tests/fixtures/directives/directiveArgFieldInvalid.invalid.ts:4:1
    4 type MyInput = { a: string };
      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Parent input type defined here
