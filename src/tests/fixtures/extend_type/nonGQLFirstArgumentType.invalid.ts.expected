-----------------
INPUT
----------------- 
/** @gqlType */
class SomeType {
  // No fields
}

class Foo {}

/** @gqlField */
export function greeting(query: Foo): string {
  return "Hello world!";
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/extend_type/nonGQLFirstArgumentType.invalid.ts:9:33 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

9 export function greeting(query: Foo): string {
                                  ~~~
