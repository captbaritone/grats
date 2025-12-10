## input

```ts title="input_type_one_of/simpleOneOf.ts"
/**
 * @gqlInput
 */
export type Greeting = { firstName: string } | { lastName: string };
```

## Output

### SDL

```graphql
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