-----------------
INPUT
----------------- 
/** @gqlType */
type Query = {};

/** @gqlField */
export function foo(_: Query): string {
  return "foo";
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/type_definitions_from_alias/QueryAsAliasOfObject.invalid.ts:2:14 - error: Operation types `Query`, `Mutation`, and `Subscription` must be defined as type aliases of `unknown`. E.g. `type Query = unknown`. This is because GraphQL servers do not have an agreed upon way to produce root values, and Grats errs on the side of safety. If you are trying to implement dependency injection, consider using the `context` argument passed to each resolver instead. If you have a strong use case for a concrete root value, please file an issue.

2 type Query = {};
               ~~
