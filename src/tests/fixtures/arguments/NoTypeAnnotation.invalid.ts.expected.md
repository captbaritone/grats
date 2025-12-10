## input

```ts title="arguments/NoTypeAnnotation.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args): string {
    return "Hello world!";
  }
}
```

## Output

```
src/tests/fixtures/arguments/NoTypeAnnotation.invalid.ts:4:9 - error: Missing type annotation for resolver argument. Expected all resolver arguments to have an explicit type annotation. Grats needs to be able to see the type of the arguments to generate an executable GraphQL schema.

4   hello(args): string {
          ~~~~
```