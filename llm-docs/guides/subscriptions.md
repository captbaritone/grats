# Subscriptions

Graphql-js expects subscription fields to return an `AsyncIterable`. Grats enforces this pattern by requiring that subscription fields return an `AsyncIterable<T>`. Beyond that, there is nothing special about subscriptions in Grats.

## Example

```tsx
import { Int } from "grats";

/** @gqlSubscriptionField */
export async function* countdown(): AsyncIterable<Int> {
  for (let i = 10; i >= 0; i--) {
    await sleep(1);
    yield i;
  }
}

function sleep(s: number) {
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
}
```

_Generated GraphQL schema:_

```graphql
type Subscription {
  countdown: Int
}
```

## Working Example

See our [Yoga Example Project](../examples/yoga.md) for a working example of subscriptions in Grats.
