-----------------
INPUT
----------------- 
/** @gqlType */
type Query = unknown;

/** @gqlField */
export function greeting<T>(_: Query): T {
  return null as any;
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/generics/referencingMethodGeneric.invalid.ts:5:40 - error: Type parameter not valid

5 export function greeting<T>(_: Query): T {
                                         ~

  src/tests/fixtures/generics/referencingMethodGeneric.invalid.ts:5:26
    5 export function greeting<T>(_: Query): T {
                               ~
    Defined here
