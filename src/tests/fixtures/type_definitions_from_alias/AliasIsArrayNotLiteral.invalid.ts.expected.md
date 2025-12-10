-----------------
INPUT
----------------- 
/** @gqlType */
export type SomeType = {
  hello: string;
}[];

-----------------
OUTPUT
-----------------
src/tests/fixtures/type_definitions_from_alias/AliasIsArrayNotLiteral.invalid.ts:2:24 - error: Expected `@gqlType` type to be an object type literal (`{ }`) or `unknown`. For example: `type Foo = { bar: string }` or `type Query = unknown`.

2 export type SomeType = {
                         ~
3   hello: string;
  ~~~~~~~~~~~~~~~~
4 }[];
  ~~~
