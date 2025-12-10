## input

```ts title="input_type_one_of/oneOfFieldTypeListOfNullable.ts"
/**
 * @gqlInput
 */
export type Greeting =
  | { firstName: string }
  | { lastName: Array<string | null> };
```

## Output

```
-- SDL --
input Greeting @oneOf {
  firstName: String
  lastName: [String]
}
-- TypeScript --
import { GraphQLSchema, GraphQLInputObjectType, GraphQLString, GraphQLList } from "graphql";
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
                    type: new GraphQLList(GraphQLString)
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