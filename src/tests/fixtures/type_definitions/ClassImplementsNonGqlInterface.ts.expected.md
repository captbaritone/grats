# type_definitions/ClassImplementsNonGqlInterface.ts

## Input

```ts title="type_definitions/ClassImplementsNonGqlInterface.ts"
/**
 * The root of all evil.
 * @gqlType
 */
export default class User implements IPerson {
  /** @gqlField */
  hello: string;
}

interface IPerson {
  hello: string;
}
```

## Output

### SDL

```graphql
"""The root of all evil."""
type User {
  hello: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        description: "The root of all evil.",
        fields() {
            return {
                hello: {
                    name: "hello",
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