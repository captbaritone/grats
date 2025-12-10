## input

```ts title="input_types/InputTypeInterfacePromiseField.invalid.ts"
/** @gqlInput */
interface MyInputType {
  someMethod: Promise<string>;
}
```

## Output

```
src/tests/fixtures/input_types/InputTypeInterfacePromiseField.invalid.ts:3:15 - error: `Promise` is not a valid as an input type.

3   someMethod: Promise<string>;
                ~~~~~~~~~~~~~~~
```