# user_error/InvalidSyntax.invalid.ts

## Input

```ts title="user_error/InvalidSyntax.invalid.ts"
/** @gqlType */
class #Foo {

}
```

## Output

### Error Report

```text
src/tests/fixtures/user_error/InvalidSyntax.invalid.ts:2:7 - error TS1005: '{' expected.

2 class #Foo {
        ~~~~
```