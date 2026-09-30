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
src/tests/fixtures/user_error/InvalidSyntax.invalid.ts:2:7 - error: Expected `{` but found `#identifier`

2 class #Foo {
        ~~~~
```