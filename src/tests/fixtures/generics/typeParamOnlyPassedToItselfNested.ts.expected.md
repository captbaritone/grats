# generics/typeParamOnlyPassedToItselfNested.ts

## Input

```ts title="generics/typeParamOnlyPassedToItselfNested.ts"
// `Tree` passes its type parameter back to itself wrapped in another type, but
// doesn't use it in a GraphQL position, so it's not generic and doesn't expand
// infinitely.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Tree<T> = {
  /** @gqlField */
  children: Tree<Tree<T>>;
  notGql: T;
};

/** @gqlQueryField */
export function tree(): Tree<User> {
  return null as any;
}
```

## Output

### SDL

```graphql
type Query {
  tree: Tree
}

type Tree {
  children: Tree
}

type User {
  name: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { tree as queryTreeResolver } from "./typeParamOnlyPassedToItselfNested";
export function getSchema(): GraphQLSchema {
    const TreeType: GraphQLObjectType = new GraphQLObjectType({
        name: "Tree",
        fields() {
            return { children: {
                name: "children",
                type: TreeType
            } };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return { tree: {
                name: "tree",
                type: TreeType,
                resolve() {
                    return queryTreeResolver();
                }
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
    return new GraphQLSchema({
        query: QueryType,
        types: [
            QueryType,
            TreeType,
            UserType
        ]
    });
}
```