# generics/genericFunctionField.ts

## Input

```ts title="generics/genericFunctionField.ts"
/** @gqlType */
export class Page<T> {
  /** @gqlField */
  items: T[];
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;
}

/** @gqlType */
export class Post {
  /** @gqlField */
  title: string;
}

/** @gqlField */
export function first<T>(page: Page<T>): T | null {
  return page.items[0] ?? null;
}

/** @gqlQueryField */
export function users(): Page<User> {
  return new Page();
}

/** @gqlQueryField */
export function posts(): Page<Post> {
  return new Page();
}
```

## Output

### SDL

```graphql
type Post {
  title: String
}

type PostPage {
  first: Post
  items: [Post!]
}

type Query {
  posts: PostPage
  users: UserPage
}

type User {
  name: String
}

type UserPage {
  first: User
  items: [User!]
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLList, GraphQLNonNull } from "graphql";
import { first as postPageFirstResolver, posts as queryPostsResolver, first as userPageFirstResolver, users as queryUsersResolver } from "./genericFunctionField";
export function getSchema(): GraphQLSchema {
    const PostType: GraphQLObjectType = new GraphQLObjectType({
        name: "Post",
        fields() {
            return { title: {
                name: "title",
                type: GraphQLString
            } };
        }
    });
    const PostPageType: GraphQLObjectType = new GraphQLObjectType({
        name: "PostPage",
        fields() {
            return {
                first: {
                    name: "first",
                    type: PostType,
                    resolve(source) {
                        return postPageFirstResolver(source);
                    }
                },
                items: {
                    name: "items",
                    type: new GraphQLList(new GraphQLNonNull(PostType))
                }
            };
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
    const UserPageType: GraphQLObjectType = new GraphQLObjectType({
        name: "UserPage",
        fields() {
            return {
                first: {
                    name: "first",
                    type: UserType,
                    resolve(source) {
                        return userPageFirstResolver(source);
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
            return {
                posts: {
                    name: "posts",
                    type: PostPageType,
                    resolve() {
                        return queryPostsResolver();
                    }
                },
                users: {
                    name: "users",
                    type: UserPageType,
                    resolve() {
                        return queryUsersResolver();
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [
            PostType,
            PostPageType,
            QueryType,
            UserType,
            UserPageType
        ]
    });
}
```