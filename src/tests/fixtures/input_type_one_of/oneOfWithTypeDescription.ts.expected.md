# input_type_one_of/oneOfWithTypeDescription.ts

## Input

```ts title="input_type_one_of/oneOfWithTypeDescription.ts"
/**
 * A popular way to greet someone.
 *
 * @gqlInput
 */
export type Greeting = { firstName: string } | { lastName: string };
```

## Output

### SDL

```graphql
"""A popular way to greet someone."""
input Greeting @oneOf {
  firstName: String
  lastName: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInputObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const GreetingType: GraphQLInputObjectType = new GraphQLInputObjectType({
        description: "A popular way to greet someone.",
        name: "Greeting",
        fields() {
            return {
                firstName: {
                    name: "firstName",
                    type: GraphQLString
                },
                lastName: {
                    name: "lastName",
                    type: GraphQLString
                }
            };
        },
        isOneOf: true
    });
    return new GraphQLSchema({
        types: [GreetingType]
    });
}
```