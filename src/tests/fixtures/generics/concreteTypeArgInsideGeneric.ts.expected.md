# generics/concreteTypeArgInsideGeneric.ts

## Input

```ts title="generics/concreteTypeArgInsideGeneric.ts"
// A generic type may pass concrete types, as well as its own type parameters,
// to other generic types.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};
/** @gqlType */
type Post = {
  /** @gqlField */
  title: string;
};

/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
};

/** @gqlType */
type Connection<T> = {
  /** @gqlField */
  edges: Edge<T>[];
  /** @gqlField */
  other: Edge<Post>;
};

/** @gqlQueryField */
export function users(): Connection<User> {
  return null as any;
}
```

## Output

### SDL

```graphql
type Post {
  title: String
}

type PostEdge {
  node: Post
}

type Query {
  users: UserConnection
}

type User {
  name: String
}

type UserConnection {
  edges: [UserEdge!]
  other: PostEdge
}

type UserEdge {
  node: User
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from "graphql";
import { users as queryUsersResolver } from "./concreteTypeArgInsideGeneric";
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
    const PostType: GraphQLObjectType = new GraphQLObjectType({
        name: "Post",
        fields() {
            return { title: {
                name: "title",
                type: GraphQLString
            } };
        }
    });
    const PostEdgeType: GraphQLObjectType = new GraphQLObjectType({
        name: "PostEdge",
        fields() {
            return { node: {
                name: "node",
                type: PostType
            } };
        }
    });
    const UserConnectionType: GraphQLObjectType = new GraphQLObjectType({
        name: "UserConnection",
        fields() {
            return {
                edges: {
                    name: "edges",
                    type: new GraphQLList(new GraphQLNonNull(UserEdgeType))
                },
                other: {
                    name: "other",
                    type: PostEdgeType
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return { users: {
                name: "users",
                type: UserConnectionType,
                resolve() {
                    return queryUsersResolver();
                }
            } };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [
            PostType,
            PostEdgeType,
            QueryType,
            UserType,
            UserConnectionType,
            UserEdgeType
        ]
    });
}
```