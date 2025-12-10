## input

```ts title="regression/fieldFollowedByDeprecated.ts"
/** @gqlType */
class User {
  /**
   * @gqlField name
   * @deprecated
   */
  graphQLName(): string {
    return "Sup";
  }
}
```

## Output

### SDL

```graphql
type User {
  name: String @deprecated
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
                    deprecationReason: "No longer supported",
                    name: "name",
                    type: GraphQLString,
                    resolve(source) {
                        return source.graphQLName();
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [UserType]
    });
}
```