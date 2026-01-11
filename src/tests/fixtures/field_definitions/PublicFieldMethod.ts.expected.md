# field_definitions/PublicFieldMethod.ts

## Input

```ts title="field_definitions/PublicFieldMethod.ts"
/** @gqlType */
export class User {
  /** @gqlField */
  public greet(): string {
    return "Hello";
  }
}
```

## Output

### SDL

```graphql
type User {
  greet: String
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
                greet: {
                    name: "greet",
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