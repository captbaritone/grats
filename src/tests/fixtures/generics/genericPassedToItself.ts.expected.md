# generics/genericPassedToItself.ts

## Input

```ts title="generics/genericPassedToItself.ts"
// A generic type's instantiation may be passed as its own type argument.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
};

/** @gqlQueryField */
export function edge(): Edge<Edge<User>> {
  return null as any;
}
```

## Output

### SDL

```graphql
type Query {
  edge: UserEdgeEdge
}

type User {
  name: String
}

type UserEdge {
  node: User
}

type UserEdgeEdge {
  node: UserEdge
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { edge as queryEdgeResolver } from "./genericPassedToItself";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return { name: {
                name: "name",
                type: GraphQLString
            } };
        }
    });
    const UserEdgeType: GraphQLObjectType = new GraphQLObjectType({
        name: "UserEdge",
        fields() {
            return { node: {
                name: "node",
                type: UserType
            } };
        }
    });
    const UserEdgeEdgeType: GraphQLObjectType = new GraphQLObjectType({
        name: "UserEdgeEdge",
        fields() {
            return { node: {
                name: "node",
                type: UserEdgeType
            } };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return { edge: {
                name: "edge",
                type: UserEdgeEdgeType,
                resolve() {
                    return queryEdgeResolver();
                }
            } };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [
            QueryType,
            UserType,
            UserEdgeType,
            UserEdgeEdgeType
        ]
    });
}
```