-----------------
INPUT
----------------- 
type NotGraphql = any;

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting: NotGraphql }): string {
    return "Hello world!";
  }
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/arguments/ArgReferencesNonGqlType.invalid.ts:6:35 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

6   hello({ greeting }: { greeting: NotGraphql }): string {
                                    ~~~~~~~~~~
