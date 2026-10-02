# generics/typeArgsDifferOnlyInNonGqlParam.ts

## Input

```ts title="generics/typeArgsDifferOnlyInNonGqlParam.ts"
// References which differ only in type arguments for type parameters not used
// in a GraphQL position are the same GraphQL type.
/** @gqlType */
type User = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Page<T, Cursor> = {
  /** @gqlField */
  items: T[];
  cursor: Cursor;
};

/** @gqlQueryField */
export function byId(): Page<User, string> {
  return null as any;
}

/** @gqlQueryField */
export function byOffset(): Page<User, number> {
  return null as any;
}
```

## Output

### SDL

```graphql
type Query {
  byId: UserPage
  byOffset: UserPage
}

type User {
  name: String
}

type UserPage {
  items: [User!]
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from "graphql";
import { byId as queryByIdResolver, byOffset as queryByOffsetResolver } from "./typeArgsDifferOnlyInNonGqlParam";
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
    const UserPageType: GraphQLObjectType = new GraphQLObjectType({
        name: "UserPage",
        fields() {
            return { items: {
                name: "items",
                type: new GraphQLList(new GraphQLNonNull(UserType))
            } };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                byId: {
                    name: "byId",
                    type: UserPageType,
                    resolve() {
                        return queryByIdResolver();
                    }
                },
                byOffset: {
                    name: "byOffset",
                    type: UserPageType,
                    resolve() {
                        return queryByOffsetResolver();
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [
            QueryType,
            UserType,
            UserPageType
        ]
    });
}
```