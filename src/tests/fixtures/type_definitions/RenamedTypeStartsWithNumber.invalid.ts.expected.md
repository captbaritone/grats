# type_definitions/RenamedTypeStartsWithNumber.invalid.ts

## Input

```ts title="type_definitions/RenamedTypeStartsWithNumber.invalid.ts"
/**
 * @gqlType 1SomeType
 */
class MyClass {
  /** @gqlField */
  hello(): string {
    return "Hello world!";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/type_definitions/RenamedTypeStartsWithNumber.invalid.ts:2:4 - error: Names must start with [_a-zA-Z] but "1SomeType" does not.

2  * @gqlType 1SomeType
     ~~~~~~~~~~~~~~~~~~
3  */
  ~
```