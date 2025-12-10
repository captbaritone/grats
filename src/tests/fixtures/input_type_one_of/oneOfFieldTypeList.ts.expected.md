## input

```ts title="input_type_one_of/oneOfFieldTypeList.ts"
/**
 * @gqlInput
 */
export type Greeting = { firstName: string } | { lastName: Array<string> };
```

## Output

### SDL

```graphql
input Greeting @oneOf {
  firstName: String
  lastName: [String!]
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInputObjectType, GraphQLString, GraphQLList, GraphQLNonNull } from "graphql";
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
                    type: new GraphQLList(new GraphQLNonNull(GraphQLString))
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