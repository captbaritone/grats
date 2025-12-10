## input

```ts title="type_definitions/RenamedTypeHasDash.invalid.ts"
/**
 * @gqlType Some-Type
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
src/tests/fixtures/type_definitions/RenamedTypeHasDash.invalid.ts:2:4 - error: Names must only contain [_a-zA-Z0-9] but "Some-Type" does not.

2  * @gqlType Some-Type
     ~~~~~~~~~~~~~~~~~~
3  */
  ~
```