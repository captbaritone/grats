# top_level_fields/rootSubscriptionFieldNotAsyncIterable.invalid.ts

## Input

```ts title="top_level_fields/rootSubscriptionFieldNotAsyncIterable.invalid.ts"
/** @gqlSubscriptionField */
export function foo(): string {
  return "Hello";
}
```

## Output

### Error Report

```text
src/tests/fixtures/top_level_fields/rootSubscriptionFieldNotAsyncIterable.invalid.ts:2:24 - error: Expected fields on `Subscription` to return an `AsyncIterable`. Fields on `Subscription` model a subscription, which is a stream of events. Grats expects fields on `Subscription` to return an `AsyncIterable` which can be used to model this stream.

2 export function foo(): string {
                         ~~~~~~
```