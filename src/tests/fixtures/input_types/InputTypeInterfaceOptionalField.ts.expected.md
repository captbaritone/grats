# input_types/InputTypeInterfaceOptionalField.ts

## Input

```ts title="input_types/InputTypeInterfaceOptionalField.ts"
/** @gqlInput */
interface MyInputType {
  someField?: string;
}
```

## Output

### SDL

```graphql
input MyInputType {
  someField: String
}
```

### TypeScript

```ts
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