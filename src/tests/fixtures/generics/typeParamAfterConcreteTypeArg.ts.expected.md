# generics/typeParamAfterConcreteTypeArg.ts

## Input

```ts title="generics/typeParamAfterConcreteTypeArg.ts"
// A type parameter may be passed to a generic type after a concrete type argument.
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
type Pair<A, B> = {
  /** @gqlField */
  first: A;
  /** @gqlField */
  second: B;
};

/** @gqlType */
type Wrapper<T> = {
  /** @gqlField */
  pair: Pair<User, T>;
};

/** @gqlQueryField */
export function wrapper(): Wrapper<Post> {
  return null as any;
}
```

## Output

### SDL

```graphql
type Post {
  title: String
}

type PostWrapper {
  pair: UserPostPair
}

type Query {
  wrapper: PostWrapper
}

type User {
  name: String
}

type UserPostPair {
  first: User
  second: Post
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { wrapper as queryWrapperResolver } from "./typeParamAfterConcreteTypeArg";
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
    const PostType: GraphQLObjectType = new GraphQLObjectType({
        name: "Post",
        fields() {
            return { title: {
                name: "title",
                type: GraphQLString
            } };
        }
    });
    const UserPostPairType: GraphQLObjectType = new GraphQLObjectType({
        name: "UserPostPair",
        fields() {
            return {
                first: {
                    name: "first",
                    type: UserType
                },
                second: {
                    name: "second",
                    type: PostType
                }
            };
        }
    });
    const PostWrapperType: GraphQLObjectType = new GraphQLObjectType({
        name: "PostWrapper",
        fields() {
            return { pair: {
                name: "pair",
                type: UserPostPairType
            } };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return { wrapper: {
                name: "wrapper",
                type: PostWrapperType,
                resolve() {
                    return queryWrapperResolver();
                }
            } };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [
            PostType,
            PostWrapperType,
            QueryType,
            UserType,
            UserPostPairType
        ]
    });
}
```