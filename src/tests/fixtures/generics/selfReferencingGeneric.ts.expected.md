# generics/selfReferencingGeneric.ts

## Input

```ts title="generics/selfReferencingGeneric.ts"
// A generic type may reference itself with its own type parameter.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Node<T> = {
  /** @gqlField */
  value: T;
  /** @gqlField */
  next: Node<T> | null;
};

/** @gqlQueryField */
export function list(): Node<User> {
  return null as any;
}
```

## Output

### SDL

```graphql
type Query {
  list: UserNode
}

type User {
  name: String
}

type UserNode {
  next: UserNode
  value: User
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { list as queryListResolver } from "./selfReferencingGeneric";
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
    const UserNodeType: GraphQLObjectType = new GraphQLObjectType({
        name: "UserNode",
        fields() {
            return {
                next: {
                    name: "next",
                    type: UserNodeType
                },
                value: {
                    name: "value",
                    type: UserType
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return { list: {
                name: "list",
                type: UserNodeType,
                resolve() {
                    return queryListResolver();
                }
            } };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [
            QueryType,
            UserType,
            UserNodeType
        ]
    });
}
```