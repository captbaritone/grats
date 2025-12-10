## input

```ts title="input_types/InputTypeInterfaceOptionalField.ts"
/** @gqlInput */
interface MyInputType {
  someField?: string;
}
```

## Output

```
-- SDL --
input MyInputType {
  someField: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLInputObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const MyInputTypeType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "MyInputType",
        fields() {
            return {
                someField: {
                    name: "someField",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [MyInputTypeType]
    });
}
```