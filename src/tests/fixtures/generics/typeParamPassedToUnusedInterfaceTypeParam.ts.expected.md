# generics/typeParamPassedToUnusedInterfaceTypeParam.ts

## Input

```ts title="generics/typeParamPassedToUnusedInterfaceTypeParam.ts"
// `Friendly` doesn't use its type parameter in a GraphQL position, so neither
// does `User`, which is therefore not generic.
/** @gqlType */
export class User<T> implements Friendly<T> {
  __typename: "User";
  /** @gqlField */
  name: string;
}

/** @gqlInterface */
interface Friendly<T> {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class Dog {
  /** @gqlField */
  name: string;
  /** @gqlField */
  bestFriend: User<Dog>;
}
```

## Output

### SDL

```graphql
interface Friendly {
  name: String
}

type Dog {
  bestFriend: User
  name: String
}

type User implements Friendly {
  name: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const FriendlyType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "Friendly",
        fields() {
            return { name: {
                name: "name",
                type: GraphQLString
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
        },
        interfaces() {
            return [FriendlyType];
        }
    });
    const DogType: GraphQLObjectType = new GraphQLObjectType({
        name: "Dog",
        fields() {
            return {
                bestFriend: {
                    name: "bestFriend",
                    type: UserType
                },
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({ types: [
        FriendlyType,
        DogType,
        UserType
    ] });
}
```