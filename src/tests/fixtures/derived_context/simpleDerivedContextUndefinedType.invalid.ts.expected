-----------------
INPUT
----------------- 
/** @gqlContext */
type RootContext = {
  userName: string;
};

// type DerivedContext = {
//   greeting: string;
// };

/** @gqlContext */
export function createDerivedContext(ctx: RootContext): DerivedContext {
  return { greeting: `Hello, ${ctx.userName}!` };
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting(_: Query, ctx: DerivedContext): string {
  return ctx.greeting;
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/derived_context/simpleDerivedContextUndefinedType.invalid.ts:11:57 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

11 export function createDerivedContext(ctx: RootContext): DerivedContext {
                                                           ~~~~~~~~~~~~~~
