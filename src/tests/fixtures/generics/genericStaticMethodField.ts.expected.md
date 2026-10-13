# generics/genericStaticMethodField.ts

## Input

```ts title="generics/genericStaticMethodField.ts"
/** @gqlType */
export class Page<T> {
  /** @gqlField */
  items: T[];
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;

  /** @gqlField */
  static firstOf<T>(page: Page<T>): T | null {
    return page.items[0] ?? null;
  }
}

/** @gqlQueryField */
export function users(): Page<User> {
  return new Page();
}
```

## Output

### SDL

```graphql
type Query {
  users: UserPage
}

type User {
  name: String
}

type UserPage {
  firstOf: User
  items: [User!]
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLList, GraphQLNonNull } from "graphql";
import { User as userPageFirstOfResolver, users as queryUsersResolver } from "./genericStaticMethodField";
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
            return {
                firstOf: {
                    name: "firstOf",
                    type: UserType,
                    resolve(source) {
                        return userPageFirstOfResolver.firstOf(source);
                    }
                },
                items: {
                    name: "items",
                    type: new GraphQLList(new GraphQLNonNull(UserType))
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return { users: {
                name: "users",
                type: UserPageType,
                resolve() {
                    return queryUsersResolver();
                }
            } };
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