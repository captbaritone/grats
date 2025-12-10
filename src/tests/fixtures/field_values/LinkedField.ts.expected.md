## input

```ts title="field_values/LinkedField.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  async me(): Promise<User> {
    return new User();
  }
}

/** @gqlType */
class User {
  /** @gqlField */
  name(): string {
    return "Alice";
  }
  /** @gqlField */
  friends(): User[] {
    return [new User()];
  }
}
```

## Output

```
-- SDL --
type SomeType {
  me: User
}

type User {
  friends: [User!]
  name: String
}
-- TypeScript --
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