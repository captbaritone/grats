## input

```ts title="subscriptions/SubscriptionClassWithAsyncIterable.invalid.ts"
/** @gqlType */
export class Subscription {
  /** @gqlField */
  async *greetings(): AsyncIterable<string> {
    yield "Hello";
    yield "World";
  }
}
```

## Output

```
src/tests/fixtures/subscriptions/SubscriptionClassWithAsyncIterable.invalid.ts:2:14 - error: Operation types `Query`, `Mutation`, and `Subscription` must be defined as type aliases of `unknown`. E.g. `type Query = unknown`. This is because GraphQL servers do not have an agreed upon way to produce root values, and Grats errs on the side of safety. If you are trying to implement dependency injection, consider using the `context` argument passed to each resolver instead. If you have a strong use case for a concrete root value, please file an issue.

2 export class Subscription {
               ~~~~~~~~~~~~
```