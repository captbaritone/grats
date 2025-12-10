## input

```ts title="field_values/RenamedType.ts"
/** @gqlType User */
class UserResolver {
  /** @gqlField */
  name: string;
}

/** @gqlType */
class SomeType {
  /** @gqlField */
  me: UserResolver;
}
```

## Output

```
-- SDL --
type SomeType {
  me: User
}

type User {
  name: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
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