# input_types/InputTypeInterfaceMethod.invalid.ts

## Input

```ts title="input_types/InputTypeInterfaceMethod.invalid.ts"
/** @gqlInput */
interface MyInputType {
  someMethod(): string;
}
```

## Output

### Error Report

```text
src/tests/fixtures/input_types/InputTypeInterfaceMethod.invalid.ts:3:3 - error: `@gqlInput` types only support property signature members. e.g. `type MyInput = { foo: string }`

If you think Grats should be able to infer this input field, please report an issue at https://github.com/captbaritone/grats/issues.

3   someMethod(): string;
    ~~~~~~~~~~~~~~~~~~~~~
```