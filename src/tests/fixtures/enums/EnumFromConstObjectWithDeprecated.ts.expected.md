# enums/EnumFromConstObjectWithDeprecated.ts

## Input

```ts title="enums/EnumFromConstObjectWithDeprecated.ts"
const Status = {
  Draft: "DRAFT",
  Published: "PUBLISHED",
  /** @deprecated Use DRAFT instead */
  Hidden: "HIDDEN",
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
  DRAFT
  HIDDEN @deprecated(reason: "Use DRAFT instead")
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
                value: "DRAFT"
            },
            HIDDEN: {
                deprecationReason: "Use DRAFT instead",
                value: "HIDDEN"
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