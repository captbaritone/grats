# generics/defineFieldOnGeneric.ts

## Input

```ts title="generics/defineFieldOnGeneric.ts"
/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
type Page = {
  /** @gqlField */
  title: string;
};

/**
 * Re-expose title directly on the edge
 * @gqlField */
export function title(edge: Edge<Page>): string {
  return edge.node.title;
}
```

## Output

### SDL

```graphql
type Page {
  title: String
}

type PageEdge {
  cursor: String
  node: Page
  """Re-expose title directly on the edge"""
  title: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { title as pageEdgeTitleResolver } from "./defineFieldOnGeneric";
export function getSchema(): GraphQLSchema {
    const PageType: GraphQLObjectType = new GraphQLObjectType({
        name: "Page",
        fields() {
            return {
                title: {
                    name: "title",
                    type: GraphQLString
                }
            };
        }
    });
    const PageEdgeType: GraphQLObjectType = new GraphQLObjectType({
        name: "PageEdge",
        fields() {
            return {
                cursor: {
                    name: "cursor",
                    type: GraphQLString
                },
                node: {
                    name: "node",
                    type: PageType
                },
                title: {
                    description: "Re-expose title directly on the edge",
                    name: "title",
                    type: GraphQLString,
                    resolve(source) {
                        return pageEdgeTitleResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [PageType, PageEdgeType]
    });
}
```