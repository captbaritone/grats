-----------------
INPUT
----------------- 
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export function greeting(query: { name: string }): string {
  return "Hello world!";
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/extend_type/nonAliasFirstArgumentType.invalid.ts:7:33 - error: Expected first argument of a `@gqlField` function to be typed as a type reference. Grats treats the first argument as the parent object of the field. Therefore Grats needs to see the _type_ of the first argument in order to know to which type/interface this field should be added.

7 export function greeting(query: { name: string }): string {
                                  ~~~~~~~~~~~~~~~~
