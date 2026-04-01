# enums/EnumFromConstArrayInFunction.ts

## Input

```ts title="enums/EnumFromConstArrayInFunction.ts"
function setup() {
  const ALL_STATUSES = ["DRAFT", "PUBLISHED"] as const;

  /** @gqlEnum */
  type ShowStatus = (typeof ALL_STATUSES)[number];
}
```

## Output

### SDL

```graphql
enum ShowStatus {
  DRAFT
  PUBLISHED
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLEnumType } from "graphql";
export function getSchema(): GraphQLSchema {
    const ShowStatusType: GraphQLEnumType = new GraphQLEnumType({
        name: "ShowStatus",
        values: {
            DRAFT: {
                value: "DRAFT"
            },
            PUBLISHED: {
                value: "PUBLISHED"
            }
        }
    });
    return new GraphQLSchema({
        types: [ShowStatusType]
    });
}
```