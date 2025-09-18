-----------------
INPUT
----------------- 
export class SomeNonGraphQLClass {
  /** @gqlQueryField */
  greeting(): string {
    return "Hello world";
  }
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/top_level_fields/queryFieldOnMethod.invalid.ts:2:7 - error: `@gqlQueryField` can only be used on function or static method declarations.

2   /** @gqlQueryField */
        ~~~~~~~~~~~~~~~
