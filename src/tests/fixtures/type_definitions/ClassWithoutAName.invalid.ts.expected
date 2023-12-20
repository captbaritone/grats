-----------------
INPUT
----------------- 
/**
 * @gqlType
 */
export default class {
  /** @gqlField */
  hello(): string {
    return "Hello world!";
  }
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/type_definitions/ClassWithoutAName.invalid.ts:4:1 - error: Unexpected `@gqlType` annotation on unnamed class declaration. Grats uses the name of the class to derive the name of the GraphQL type. Consider naming the class.

  4 export default class {
    ~~~~~~~~~~~~~~~~~~~~~~
  5   /** @gqlField */
    ~~~~~~~~~~~~~~~~~~
... 
  8   }
    ~~~
  9 }
    ~
