-----------------
INPUT
----------------- 
/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: MyEnum;
}

/** @gqlEnum */
type MyEnum = "VALID" | number;

-----------------
OUTPUT
-----------------
src/tests/fixtures/enums/EnumFromUnionTypeNotLiteral.invalid.ts:8:25 - error: Expected `@gqlEnum` enum members to be string literal types. For example: `'foo'`. Grats needs to be able to see the concrete value of the enum member to generate the GraphQL schema.

If you think Grats should be able to infer this union member, please report an issue at https://github.com/captbaritone/grats/issues.

8 type MyEnum = "VALID" | number;
                          ~~~~~~
