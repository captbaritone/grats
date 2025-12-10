## input

```ts title="field_values/LinkedFieldWithTypeArg.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  async me(): Promise<User<string>> {
    return new User();
  }
}

/** @gqlType */
class User<T> {
  /** @gqlField */
  name(): string {
    return "Alice";
  }
  /** @gqlField */
  friends(): User[] {
    return [new User()];
  }

  other: T;
}
```

## Output

### SDL

```graphql
type SomeType {
  me: User
}

type User {
  friends: [User!]
  name: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                friends: {
                    name: "friends",
                    type: new GraphQLList(new GraphQLNonNull(UserType))
                },
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        }
    });
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                me: {
                    name: "me",
                    type: UserType
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType, UserType]
    });
}
```