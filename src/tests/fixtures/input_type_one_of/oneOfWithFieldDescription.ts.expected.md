# input_type_one_of/oneOfWithFieldDescription.ts

## Input

```ts title="input_type_one_of/oneOfWithFieldDescription.ts"
// Known issue, descriptions are not parsed?

/**
 * @gqlInput
 */
export type Greeting =
  /** First Name */
  | { firstName: string }
  /** Last Name */
  | { lastName: string };
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