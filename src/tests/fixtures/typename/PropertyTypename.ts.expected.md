## input

```ts title="typename/PropertyTypename.ts"
/** @gqlType */
export class User {
  __typename = "User" as const;
  /** @gqlField */
  name: string = "Alice";
}
```

## Output

### SDL

```graphql
type User {
  name: String
}
```

### TypeScript

```ts
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
    return new GraphQLSchema({
        types: [UserType]
    });
}
```