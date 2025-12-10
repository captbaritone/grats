## input

```ts title="field_definitions/PrivateAndProtectedFieldMethods.invalid.ts"
/** @gqlType */
export class User {
  /** @gqlField */
  private greet(): string {
    return "Hello";
  }
  /** @gqlField */
  protected greet2(): string {
    return "Hello";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/field_definitions/PrivateAndProtectedFieldMethods.invalid.ts:4:3 - error: Unexpected access modifier on `@gqlField` method. GraphQL fields must be able to be called by the GraphQL executor.

4   private greet(): string {
    ~~~~~~~
src/tests/fixtures/field_definitions/PrivateAndProtectedFieldMethods.invalid.ts:8:3 - error: Unexpected access modifier on `@gqlField` method. GraphQL fields must be able to be called by the GraphQL executor.

8   protected greet2(): string {
    ~~~~~~~~~
```