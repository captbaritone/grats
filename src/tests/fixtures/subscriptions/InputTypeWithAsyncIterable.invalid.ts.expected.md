## input

```ts title="subscriptions/InputTypeWithAsyncIterable.invalid.ts"
/** @gqlInput */
export type NotSubscription = {
  greetings: AsyncIterable<string>;
};
```

## Output

```
src/tests/fixtures/subscriptions/InputTypeWithAsyncIterable.invalid.ts:3:14 - error: `AsyncIterable` is not a valid as an input type.

3   greetings: AsyncIterable<string>;
               ~~~~~~~~~~~~~~~~~~~~~
```