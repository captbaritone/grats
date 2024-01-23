-----------------
INPUT
----------------- 
class Foo {
  someField: number;
}

/** @gqlInterface */
interface Foo {
  /** @gqlField */
  id: string;
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/interfaces/InterfaceMergedIntoClass.invalid.ts:6:11 - error: Unexpected merged interface. If an interface is declared multiple times in a scope, TypeScript merges them. To avoid ambiguity Grats does not support using merged interfaces as GraphQL definitions. Consider using a unique name for your TypeScript interface and renaming it.

 Learn more: https://grats.capt.dev/docs/docblock-tags/interfaces/#merged-interfaces

6 interface Foo {
            ~~~

  src/tests/fixtures/interfaces/InterfaceMergedIntoClass.invalid.ts:1:7
    1 class Foo {
            ~~~
    Other declaration
