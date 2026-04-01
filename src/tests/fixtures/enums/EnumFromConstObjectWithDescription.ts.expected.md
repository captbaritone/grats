# enums/EnumFromConstObjectWithDescription.ts

## Input

```ts title="enums/EnumFromConstObjectWithDescription.ts"
const Status = {
  /** Currently being edited */
  Draft: "DRAFT",
  /** Available to readers */
  Published: "PUBLISHED",
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
  """Currently being edited"""
  DRAFT
  """Available to readers"""
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
            DRAFT: {
                description: "Currently being edited",
                value: "DRAFT"
            },
            PUBLISHED: {
                description: "Available to readers",
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