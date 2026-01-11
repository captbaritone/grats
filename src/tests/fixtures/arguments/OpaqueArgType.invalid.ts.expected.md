# arguments/OpaqueArgType.invalid.ts

## Input

```ts title="arguments/OpaqueArgType.invalid.ts"
type SomeType = any;

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: SomeType): string {
    return "Hello world!";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/arguments/OpaqueArgType.invalid.ts:6:23 - error: Unable to resolve type reference. In order to generate a GraphQL schema, Grats needs to determine which GraphQL type is being referenced. This requires being able to resolve type references to their `@gql` annotated declaration. However this reference could not be resolved. Is it possible that this type is not defined in this file?

6   hello({ greeting }: SomeType): string {
                        ~~~~~~~~
```