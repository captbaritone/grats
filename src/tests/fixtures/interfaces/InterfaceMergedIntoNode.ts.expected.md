# interfaces/InterfaceMergedIntoNode.ts

## Input

```ts title="interfaces/InterfaceMergedIntoNode.ts"
// Note: Node is a built in class.
/** @gqlInterface */
interface Node {
  /** @gqlField */
  id: string;
}
```

## Output

### SDL

```graphql
interface Node {
  id: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
  const NodeType: GraphQLInterfaceType = new GraphQLInterfaceType({
    name: "Node",
    fields() {
      return { id: { name: "id", type: GraphQLString } };
    },
  });
  return new GraphQLSchema({ types: [NodeType] });
}
```