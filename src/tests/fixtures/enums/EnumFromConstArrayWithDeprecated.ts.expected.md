# enums/EnumFromConstArrayWithDeprecated.ts

## Input

```ts title="enums/EnumFromConstArrayWithDeprecated.ts"
const ALL_STATUSES = [
  "DRAFT",
  /** @deprecated Use DRAFT instead. */
  "UNPUBLISHED",
  "PUBLISHED",
] as const;

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
  UNPUBLISHED @deprecated(reason: "Use DRAFT instead.")
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
            DRAFT: { value: "DRAFT" },
            PUBLISHED: { value: "PUBLISHED" },
            UNPUBLISHED: {
                deprecationReason: "Use DRAFT instead.",
                value: "UNPUBLISHED"
            }
        }
    });
    const ShowType: GraphQLObjectType = new GraphQLObjectType({
        name: "Show",
        fields() {
            return { status: {
                name: "status",
                type: ShowStatusType
            } };
        }
    });
    return new GraphQLSchema({ types: [ShowStatusType, ShowType] });
}
```