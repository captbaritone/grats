# Node Interface (Global Object Identification)

The [Global Object Identification](https://graphql.org/learn/global-object-identification/) spec defines a pattern for fetching any object by a globally unique ID. It is used by clients like [Relay](https://relay.dev) to efficiently refetch individual objects and normalize cached data.

The spec requires:

-   A `Node` interface with a single `id: ID!` field
-   A root `node(id: ID!): Node` query field that can fetch any `Node` by its global ID
-   A root `nodes(ids: [ID!]!): [Node]!` query field for batch fetching

Grats provides several features that make implementing this spec straightforward, with full static type safety.

> **INFO:**
> For a full working example of the Node interface in action, see our [Production App](../examples/production-app.md) example app.

## Implementation

### Step 1: Define the Node interface

Define a TypeScript interface for `Node`. Since TypeScript has a built-in `Node` type (for DOM nodes), use a different TypeScript name and rename it with `@gqlInterface Node`:

```ts
import { ID } from "grats";
import { getTypeName } from "./schema";
import { toGlobalId } from "graphql-relay";

/** @gqlInterface Node */
export interface GraphQLNode {
  localID(): string;
}

/**
 * @gqlField
 * @killsParentOnException */
export function id(node: GraphQLNode): ID {
  return toGlobalId(getTypeName(node), node.localID());
}
```

`localID()` is a TypeScript-only contract (not a GraphQL field) that each implementor must provide. It returns the type's local (unprefixed) identifier.

The functional `@gqlField` automatically adds the `id` field to every type that implements `Node`. `getTypeName` is exported by Grats' generated `schema.ts` — it returns the GraphQL typename for any class instance, so you don't need to define `__typename` on your classes. `toGlobalId` from `graphql-relay` encodes `typename:localId` as a base64 string.

### Step 2: Implement Node on your types

Each type that should be a `Node` implements the interface and provides a static `fetchById` method:

```ts
/** @gqlType */
export class User implements GraphQLNode {
  constructor(private _id: string) {}

  localID() {
    return this._id;
  }

  static async fetchById(id: string): Promise<User | null> {
    return db.users.get(id);
  }
}
```

### Step 3: Implement the `node` and `nodes` query fields

Grats generates a `nodeClassMap` in `schema.ts` that maps every `Node` implementor's typename to its class. Use it to dispatch to the correct `fetchById`:

```ts
import { fromGlobalId } from "graphql-relay";
import { nodeClassMap } from "./schema";

/** @gqlQueryField */
export async function node(args: { id: ID }): Promise<GraphQLNode | null> {
  const { type, id } = fromGlobalId(args.id);
  const cls = nodeClassMap[type as keyof typeof nodeClassMap];
  if (cls == null) {
    throw new Error(`Type "${type}" does not implement Node`);
  }
  return cls.fetchById(id);
}

/** @gqlQueryField */
export async function nodes(ids: ID[]): Promise<Array<GraphQLNode | null>> {
  return Promise.all(ids.map((id) => node({ id })));
}
```

## Static type safety

If you add a new type that implements `GraphQLNode` but forget to add a `fetchById` static method, TypeScript will report an error at the `cls.fetchById(...)` call — because the union of all classes in `nodeClassMap` now includes a class without that method.

This eliminates the common bug of adding a `Node` implementor but forgetting to register it in the `node()` resolver.

## How it works

Grats generates two exports in `schema.ts` that power this pattern:

-   **`nodeClassMap`** — An object mapping GraphQL typenames to their class constructors for every type that implements the `Node` interface. Grats generates one of these maps per interface in your schema.
-   **`getTypeName`** — A function that returns the GraphQL typename for any class instance, using the same prototype-chain resolution that GraphQL uses internally. This lets you encode global IDs without defining `__typename` on your classes.
