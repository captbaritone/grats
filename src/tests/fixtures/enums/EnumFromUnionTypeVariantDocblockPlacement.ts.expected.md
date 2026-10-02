# enums/EnumFromUnionTypeVariantDocblockPlacement.ts

## Input

```ts title="enums/EnumFromUnionTypeVariantDocblockPlacement.ts"
/** @gqlEnum */
type WithLeadingPipe =
  /** Before the pipe. */
  | "BEFORE"
  | /** After the pipe. */ "AFTER"
  /** First docblock, which is ignored. */
  /** Last docblock. */
  | "LAST";

/** @gqlEnum */
type WithoutLeadingPipe = /** The first member. */ "FIRST" | "SECOND";

/** @gqlType */
export class SomeType {
  /** @gqlField */
  withLeadingPipe: WithLeadingPipe;
  /** @gqlField */
  withoutLeadingPipe: WithoutLeadingPipe;
}
```

## Output

### SDL

```graphql
enum WithLeadingPipe {
  """After the pipe."""
  AFTER
  """Before the pipe."""
  BEFORE
  """Last docblock."""
  LAST
}

enum WithoutLeadingPipe {
  """The first member."""
  FIRST
  SECOND
}

type SomeType {
  withLeadingPipe: WithLeadingPipe
  withoutLeadingPipe: WithoutLeadingPipe
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLEnumType, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const WithLeadingPipeType: GraphQLEnumType = new GraphQLEnumType({
        name: "WithLeadingPipe",
        values: {
            AFTER: {
                description: "After the pipe.",
                value: "AFTER"
            },
            BEFORE: {
                description: "Before the pipe.",
                value: "BEFORE"
            },
            LAST: {
                description: "Last docblock.",
                value: "LAST"
            }
        }
    });
    const WithoutLeadingPipeType: GraphQLEnumType = new GraphQLEnumType({
        name: "WithoutLeadingPipe",
        values: {
            FIRST: {
                description: "The first member.",
                value: "FIRST"
            },
            SECOND: { value: "SECOND" }
        }
    });
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                withLeadingPipe: {
                    name: "withLeadingPipe",
                    type: WithLeadingPipeType
                },
                withoutLeadingPipe: {
                    name: "withoutLeadingPipe",
                    type: WithoutLeadingPipeType
                }
            };
        }
    });
    return new GraphQLSchema({ types: [
        WithLeadingPipeType,
        WithoutLeadingPipeType,
        SomeTypeType
    ] });
}
```