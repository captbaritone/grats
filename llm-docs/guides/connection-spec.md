# Connection Spec

The [Connection Spec](https://relay.dev/graphql/connections.htm) is an opinionated formal specification for a convention of how to expose a paginated list of items in a GraphQL schema. Smart clients like [Relay](https://relay.dev) are able to use this specification to automatically handle pagination for you.

While Connections are sometimes refered to as "Relay Connections", they are not specific to Relay and can be considered a best practice for any GraphQL API.

Given that most application that we build are heavily oriented around lists of data, having a consistent way to interact with paginated lists allows clients to build helpful, optimized, abstractions for things like infinite scrolling, pagination, prelaoding, and more.

> **TIP:**
> **When possible, prefer modeling list fields using connections**, even if your server does not implement pagination yet. This will make it easier to add pagination in the future without breaking clients.
> 
> The npm library `graphql-relay` provides a number of helpful utility functions which make it easy to implement simple connection fields even from simple arrays.

## Example Connection using Grats

Grats' support for [generic types](./generics.md) is a perfect fit for modeling connections. Here's an example of a generic, reusable `Connection` type. Feel free to copy/paste these reusable types into your own code base.

> **INFO:**
> For a full working example of Connections in action, see our [Production App](../examples/production-app.md) example app.

```tsx
import { Int } from "grats";

/** @gqlQueryField */
export function users(args: {
  first?: Int | null;
  after?: string | null;
  last?: Int | null;
  before?: string | null;
}): Connection<User> {
  const users = [{ name: "John" }];
  return connectionFromArray(users, args);
}

/** --- Reusable Connection Types --- */

/** @gqlType */
export type Connection<T> = {
  /** @gqlField */
  edges: Edge<T>[];
  /** @gqlField */
  pageInfo: PageInfo;
};

/** @gqlType */
export type Edge<T> = {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
export type PageInfo = {
  /** @gqlField */
  startCursor: string | null;
  /** @gqlField */
  endCursor: string | null;
  /** @gqlField */
  hasNextPage: boolean;
  /** @gqlField */
  hasPreviousPage: boolean;
};

/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

// This function can be found in the module `graphql-relay`.
// Extracted here for example purposes.
declare function connectionFromArray<T>(
  data: ReadonlyArray<T>,
  args: {
    first?: Int | null;
    after?: string | null;
    last?: Int | null;
    before?: string | null;
  },
): Connection<T>;
```

_Generated GraphQL schema:_

```graphql
type PageInfo {
  endCursor: String
  hasNextPage: Boolean
  hasPreviousPage: Boolean
  startCursor: String
}

type Query {
  users(after: String, before: String, first: Int, last: Int): UserConnection
}

type User {
  name: String
}

type UserConnection {
  edges: [UserEdge!]
  pageInfo: PageInfo
}

type UserEdge {
  cursor: String
  node: User
}
```
