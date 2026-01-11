# arguments/NoArgsWithUnknown.invalid.ts

## Input

```ts title="arguments/NoArgsWithUnknown.invalid.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args: unknown): string {
    console.log("hello");
    return "Hello world!";
  }
}
```

## Output

### Error Report

```text
src/tests/fixtures/arguments/NoArgsWithUnknown.invalid.ts:4:15 - error: Unknown GraphQL type. Grats does not know how to map this type to a GraphQL type. You may want to define a named GraphQL type elsewhere and reference it here. If you think Grats should be able to infer a GraphQL type from this type, please file an issue.

If you think Grats should be able to infer this type, please report an issue at https://github.com/captbaritone/grats/issues.

4   hello(args: unknown): string {
                ~~~~~~~
```