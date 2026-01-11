# generics/genericTypeUsingClass.ts

## Input

```ts title="generics/genericTypeUsingClass.ts"
/** @gqlType */
type Page = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
export class Edge<T> {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
}

/** @gqlType */
type Query = unknown;

/** @gqlField */
export function createEdge(_: Query): Edge<Page> {
  return { node: { name: "My Page" }, cursor: "cursor" };
}
```

## Output

### SDL

```graphql
type Page {
  name: String
}

type PageEdge {
  cursor: String
  node: Page
}

type Query {
  createEdge: PageEdge
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { createEdge as queryCreateEdgeResolver } from "./genericTypeUsingClass";
export function getSchema(): GraphQLSchema {
    const PageType: GraphQLObjectType = new GraphQLObjectType({
        name: "Page",
        fields() {
            return {
                name: {
                    name: "name",
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
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                createEdge: {
                    name: "createEdge",
                    type: PageEdgeType,
                    resolve(source) {
                        return queryCreateEdgeResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [PageType, PageEdgeType, QueryType]
    });
}
```