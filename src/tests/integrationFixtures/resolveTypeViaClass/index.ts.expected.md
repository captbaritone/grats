# resolveTypeViaClass/index.ts

## Input

```ts title="resolveTypeViaClass/index.ts"
import { ID } from "../../../Types.js";
import { gqlNodeClassMap } from "./schema.js";
import type { GqlNode } from "./models.js";

/** @gqlQueryField */
export function node(args: { id: ID }): GqlNode {
  const [type, localId] = (args.id as string).split(":");
  const cls = gqlNodeClassMap[type as keyof typeof gqlNodeClassMap];
  if (cls == null) {
    throw new Error(`Type "${type}" does not implement GqlNode`);
  }
  return cls.fromId(localId);
}

export const query = /* GraphQL */ `
  query {
    user: node(id: "User:1") {
      __typename
      id
    }
    guest: node(id: "Guest:2") {
      __typename
      id
    }
    defaultNode: node(id: "DefaultNode:3") {
      __typename
      id
    }
    renamedNode: node(id: "RenamedNode:4") {
      __typename
      id
    }
  }
`;
```

## Output

### Query Result

```json
{
  "data": {
    "user": {
      "__typename": "User",
      "id": "User:1"
    },
    "guest": {
      "__typename": "Guest",
      "id": "Guest:2"
    },
    "defaultNode": {
      "__typename": "DefaultNode",
      "id": "DefaultNode:3"
    },
    "renamedNode": {
      "__typename": "RenamedNode",
      "id": "RenamedNode:4"
    }
  }
}
```