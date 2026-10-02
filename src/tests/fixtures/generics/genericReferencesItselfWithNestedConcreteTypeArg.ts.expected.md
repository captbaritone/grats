# generics/genericReferencesItselfWithNestedConcreteTypeArg.ts

## Input

```ts title="generics/genericReferencesItselfWithNestedConcreteTypeArg.ts"
// A generic type may reference itself with nested type arguments which don't
// include its type parameter, since that doesn't expand infinitely.
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

/** @gqlType */
type Box<T> = {
  /** @gqlField */
  value: T;
  /** @gqlField */
  edgeBox: Box<Edge<User>>;
};

/** @gqlQueryField */
export function box(): Box<User> {
  return null as any;
}
```

## Output

### SDL

```graphql
type Query {
  box: UserBox
}

type User {
  name: String
}

type UserBox {
  edgeBox: UserEdgeBox
  value: User
}

type UserEdge {
  node: User
}

type UserEdgeBox {
  edgeBox: UserEdgeBox
  value: UserEdge
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { box as queryBoxResolver } from "./genericReferencesItselfWithNestedConcreteTypeArg";
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
    const UserEdgeBoxType: GraphQLObjectType = new GraphQLObjectType({
        name: "UserEdgeBox",
        fields() {
            return {
                edgeBox: {
                    name: "edgeBox",
                    type: UserEdgeBoxType
                },
                value: {
                    name: "value",
                    type: UserEdgeType
                }
            };
        }
    });
    const UserBoxType: GraphQLObjectType = new GraphQLObjectType({
        name: "UserBox",
        fields() {
            return {
                edgeBox: {
                    name: "edgeBox",
                    type: UserEdgeBoxType
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
            return { box: {
                name: "box",
                type: UserBoxType,
                resolve() {
                    return queryBoxResolver();
                }
            } };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [
            QueryType,
            UserType,
            UserBoxType,
            UserEdgeType,
            UserEdgeBoxType
        ]
    });
}
```