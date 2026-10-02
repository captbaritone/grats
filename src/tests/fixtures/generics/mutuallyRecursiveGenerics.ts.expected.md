# generics/mutuallyRecursiveGenerics.ts

## Input

```ts title="generics/mutuallyRecursiveGenerics.ts"
// Generic types may reference each other with their type parameters.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Parent<T> = {
  /** @gqlField */
  value: T;
  /** @gqlField */
  child: Child<T>;
};

/** @gqlType */
type Child<T> = {
  /** @gqlField */
  parent: Parent<T>;
};

/** @gqlQueryField */
export function parent(): Parent<User> {
  return null as any;
}
```

## Output

### SDL

```graphql
type Query {
  parent: UserParent
}

type User {
  name: String
}

type UserChild {
  parent: UserParent
}

type UserParent {
  child: UserChild
  value: User
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { parent as queryParentResolver } from "./mutuallyRecursiveGenerics";
export function getSchema(): GraphQLSchema {
    const UserChildType: GraphQLObjectType = new GraphQLObjectType({
        name: "UserChild",
        fields() {
            return { parent: {
                name: "parent",
                type: UserParentType
            } };
        }
    });
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return { name: {
                name: "name",
                type: GraphQLString
            } };
        }
    });
    const UserParentType: GraphQLObjectType = new GraphQLObjectType({
        name: "UserParent",
        fields() {
            return {
                child: {
                    name: "child",
                    type: UserChildType
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
            return { parent: {
                name: "parent",
                type: UserParentType,
                resolve() {
                    return queryParentResolver();
                }
            } };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [
            QueryType,
            UserType,
            UserChildType,
            UserParentType
        ]
    });
}
```