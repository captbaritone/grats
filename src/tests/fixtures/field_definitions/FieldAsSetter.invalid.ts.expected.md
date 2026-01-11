# field_definitions/FieldAsSetter.invalid.ts

## Input

```ts title="field_definitions/FieldAsSetter.invalid.ts"
/** @gqlType */
export class User {
  /** @gqlField */
  set getUser(args: never) {
    //
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/FieldAsSetter.invalid.ts:4:3 - error: `@gqlField` can only be used on method/property declarations, signatures, function or static method declarations.

If you think Grats should be able to infer this field, please report an issue at https://github.com/captbaritone/grats/issues.

4   set getUser(args: never) {
    ~~~~~~~~~~~~~~~~~~~~~~~~~~
5     //
  ~~~~~~
6   }
  ~~~
```