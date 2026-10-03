# type_definitions/RenamedTypeNewLine.invalid.ts

## Input

```ts title="type_definitions/RenamedTypeNewLine.invalid.ts"
/**
 * @gqlType
 *
 * SomeType
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
src/tests/fixtures/type_definitions/RenamedTypeNewLine.invalid.ts:4:4 - error: Expected the GraphQL name `SomeType` to be on the same line as its `@gqlType` tag.

4  * SomeType
     ~~~~~~~~
```