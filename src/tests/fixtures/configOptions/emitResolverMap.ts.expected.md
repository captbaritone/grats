# configOptions/emitResolverMap.ts

## Input

```ts title="configOptions/emitResolverMap.ts"
// {"EXPERIMENTAL__emitResolverMap": true, "strictSemanticNullability": true}

import { Int } from "../../../Types";

// `Post` and `User.greet` are resolved by GraphQL's default resolver without
// a semantic non-null check, so they're left out of the resolver map.

/** @gqlType */
class Post {
  /** @gqlField */
  title: string | null;
}

/** @gqlType */
export class User {
  /** @gqlField */
  name: string;

  /** @gqlField renamedProperty */
  someProperty: string;

  /** @gqlField */
  greet(args: { greeting: string }): string | null {
    return `${args.greeting}, ${this.name}!`;
  }

  /** @gqlField */
  posts: Post[];
}

/** @gqlField */
export function age(user: User): Int {
  return 42;
}

/** @gqlQueryField */
export function me(): User {
  return new User();
}
```

## Output

### SDL

```graphql
"""
Indicates that a position is semantically non null: it is only null if there is a matching error in the `errors` array.
In all other cases, the position is non-null.

Tools doing code generation may use this information to generate the position as non-null if field errors are handled out of band:

```graphql
type User {
    # email is semantically non-null and can be generated as non-null by error-handling clients.
    email: String @semanticNonNull
}
```

The `levels` argument indicates what levels are semantically non null in case of lists:

```graphql
type User {
    # friends is semantically non null
    friends: [User] @semanticNonNull # same as @semanticNonNull(levels: [0])

    # every friends[k] is semantically non null
    friends: [User] @semanticNonNull(levels: [1])

    # friends as well as every friends[k] is semantically non null
    friends: [User] @semanticNonNull(levels: [0, 1])
}
```

`levels` are zero indexed.
Passing a negative level or a level greater than the list dimension is an error.
"""
directive @semanticNonNull(levels: [Int] = [0]) on FIELD_DEFINITION

type Post {
  title: String
}

type Query {
  me: User @semanticNonNull
}

type User {
  age: Int @semanticNonNull
  greet(greeting: String!): String
  name: String @semanticNonNull
  posts: [Post!] @semanticNonNull
  renamedProperty: String @semanticNonNull
}
```

### TypeScript

```ts
import type { IResolvers } from "@graphql-tools/utils";
import { me as queryMeResolver, age as userAgeResolver } from "./emitResolverMap";
import { defaultFieldResolver } from "graphql";
async function assertNonNull<T>(value: T | Promise<T>): Promise<T> {
    const awaited = await value;
    if (awaited == null) throw new Error("Cannot return null for semantically non-nullable field.");
    return awaited;
}
export function getResolverMap(): IResolvers {
    return {
        Query: { me() {
            return assertNonNull(queryMeResolver());
        } },
        User: {
            age(source) {
                return assertNonNull(userAgeResolver(source));
            },
            name(source, args, context, info) {
                return assertNonNull(defaultFieldResolver(source, args, context, info));
            },
            posts(source, args, context, info) {
                return assertNonNull(defaultFieldResolver(source, args, context, info));
            },
            renamedProperty(source) {
                return assertNonNull(source.someProperty);
            }
        }
    };
}
```