## input

```ts title="todo/userExample.ts"
/** @gqlType */
type SomeType = {};

/** @gqlField */
export function me(_: SomeType): User {
  return { firstName: "John", lastName: "Doe" };
}

/** @gqlType */
type User = {
  /** @gqlField */
  firstName: string;
  /** @gqlField */
  lastName: string;
};

/** @gqlField */
export function fullName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}
```

## Output

```
-- SDL --
type SomeType {
  me: User
}

type User {
  firstName: String
  fullName: String
  lastName: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { fullName as userFullNameResolver, me as someTypeMeResolver } from "./userExample";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                firstName: {
                    name: "firstName",
                    type: GraphQLString
                },
                fullName: {
                    name: "fullName",
                    type: GraphQLString,
                    resolve(source) {
                        return userFullNameResolver(source);
                    }
                },
                lastName: {
                    name: "lastName",
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
                    type: UserType,
                    resolve(source) {
                        return someTypeMeResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType, UserType]
    });
}
```