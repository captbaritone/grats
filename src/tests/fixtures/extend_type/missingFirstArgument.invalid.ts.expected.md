## input

```ts title="extend_type/missingFirstArgument.invalid.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export function greeting(/* Without an arg we can't infer the type! */): string {
  return "Hello world!";
}
```

## Output

### Error Report

```text
src/tests/fixtures/extend_type/missingFirstArgument.invalid.ts:7:17 - error: Expected `@gqlField` function to have a first argument representing the type to extend. If you don't need access to the parent object in the function, you can name the variable `_` to indicate that it is unused. e.g. `function myField(_: ParentType) {}`

7 export function greeting(/* Without an arg we can't infer the type! */): string {
                  ~~~~~~~~
```