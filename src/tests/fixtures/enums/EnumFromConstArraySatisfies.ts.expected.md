# enums/EnumFromConstArraySatisfies.ts

## Input

```ts title="enums/EnumFromConstArraySatisfies.ts"
const ALL_STATUSES = [
  "DRAFT",
  "PUBLISHED",
] as const satisfies readonly string[];

/** @gqlEnum */
type ShowStatus = (typeof ALL_STATUSES)[number];

/** @gqlType */
class Show {
  /** @gqlField */
  status: ShowStatus;
}
```

## Output

### SDL

```graphql
enum ShowStatus {
  DRAFT
  PUBLISHED
}

type Show {
  status: ShowStatus
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLEnumType, GraphQLObjectType } from "graphql";
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
    const ShowType: GraphQLObjectType = new GraphQLObjectType({
        name: "Show",
        fields() {
            return {
                status: {
                    name: "status",
                    type: ShowStatusType
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [ShowStatusType, ShowType]
    });
}
```