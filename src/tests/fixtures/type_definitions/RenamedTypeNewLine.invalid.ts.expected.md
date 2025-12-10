## input

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

```
src/tests/fixtures/type_definitions/RenamedTypeNewLine.invalid.ts:2:4 - error: Expected the GraphQL name `SomeType` to be on the same line as it's `@gqlType` tag.

2  * @gqlType
     ~~~~~~~~
3  *
  ~~
4  * SomeType
  ~~~~~~~~~~~
5  */
  ~
```