# enums/EnumFromConstArrayTypeQuery.ts

## Input

```ts title="enums/EnumFromConstArrayTypeQuery.ts"
const ALL_SHOW_STATUSES = [
  "draft",
  "scheduled",
  "unlisted",
  "published",
] as const;

/** @gqlType */
class Show {
  /** @gqlField */
  status: ShowStatus;
}

/** @gqlEnum */
type ShowStatus = (typeof ALL_SHOW_STATUSES)[number];
```

## Output

### SDL

```graphql
enum ShowStatus {
  draft
  published
  scheduled
  unlisted
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
            draft: {
                value: "draft"
            },
            published: {
                value: "published"
            },
            scheduled: {
                value: "scheduled"
            },
            unlisted: {
                value: "unlisted"
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