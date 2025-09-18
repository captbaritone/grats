-----------------
INPUT
----------------- 
class Foo {
  someMethod(
    /** @gqlField */
    foo: string,
  ): void {}
}

-----------------
OUTPUT
-----------------
src/tests/fixtures/field_definitions/FieldOnArbitraryParam.invalid.ts:4:5 - error: `@gqlField` can only be used on method/property declarations, signatures, function or static method declarations.

If you think Grats should be able to infer this field, please report an issue at https://github.com/captbaritone/grats/issues.

4     foo: string,
      ~~~~~~~~~~~
