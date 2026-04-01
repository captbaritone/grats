# enums/EnumFromConstObject.ts

## Input

```ts title="enums/EnumFromConstObject.ts"
const Status = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

/** @gqlEnum */
type Status = (typeof Status)[keyof typeof Status];

/** @gqlType */
class Show {
  /** @gqlField */
  status: Status;
}
```

## Output

### SDL

```graphql
enum Status {
  ARCHIVED
  DRAFT
  PUBLISHED
}

type Show {
  status: Status
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLEnumType, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const StatusType: GraphQLEnumType = new GraphQLEnumType({
        name: "Status",
        values: {
            ARCHIVED: {
                value: "ARCHIVED"
            },
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
                    type: StatusType
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [StatusType, ShowType]
    });
}
```