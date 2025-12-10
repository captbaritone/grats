-----------------
INPUT
----------------- 
/** @gqlType */
export class SomeType {
  /** @gqlField */
  greeting(...ctx: SomeOtherType[]): string {
    return ctx[0].greeting;
  }
}

/** @gqlContext */
type SomeOtherType = { greeting: string };

-----------------
OUTPUT
-----------------
src/tests/fixtures/resolver_context/ContextValueSpread.invalid.ts:4:12 - error: Unexpected spread argument in resolver. Grats expects all resolver arguments to be a single, explicitly-typed argument.

4   greeting(...ctx: SomeOtherType[]): string {
             ~~~
