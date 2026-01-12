# generics/names/skippedTypeParam.ts

## Input

```ts title="generics/names/skippedTypeParam.ts"
/** @gqlType */
type Edge<From, To> = {
  /** @gqlField */
  node: To;
};

/** @gqlType */
type A = {
  /** @gqlField */
  a: string;
};

/** @gqlType */
type B = {
  /** @gqlField */
  b: string;
};

/** @gqlQueryField */
export function connection(): Edge<A, B> {
  return {
    node: {
      b: "b",
    },
  };
}
```

## Output

### SDL

```graphql
type A {
  a: String
}

type B {
  b: String
}

type BEdge {
  node: B
}

type Query {
  connection: BEdge
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { connection as queryConnectionResolver } from "./skippedTypeParam";
export function getSchema(): GraphQLSchema {
    const BType: GraphQLObjectType = new GraphQLObjectType({
        name: "B",
        fields() {
            return {
                b: {
                    name: "b",
                    type: GraphQLString
                }
            };
        }
    });
    const BEdgeType: GraphQLObjectType = new GraphQLObjectType({
        name: "BEdge",
        fields() {
            return {
                node: {
                    name: "node",
                    type: BType
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                connection: {
                    name: "connection",
                    type: BEdgeType,
                    resolve() {
                        return queryConnectionResolver();
                    }
                }
            };
        }
    });
    const AType: GraphQLObjectType = new GraphQLObjectType({
        name: "A",
        fields() {
            return {
                a: {
                    name: "a",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [AType, BType, BEdgeType, QueryType]
    });
}
```