# input_types/InputTypeWithFieldDescription.ts

## Input

```ts title="input_types/InputTypeWithFieldDescription.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlInput */
type MyInputType = {
  /** Sweet field! */
  someField: string;
};
```

## Output

### SDL

```graphql
input MyInputType {
  """Sweet field!"""
  someField: String!
}

type SomeType {
  hello: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInputObjectType, GraphQLNonNull, GraphQLString, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const MyInputTypeType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "MyInputType",
        fields() {
            return {
                someField: {
                    description: "Sweet field!",
                    name: "someField",
                    type: new GraphQLNonNull(GraphQLString)
                }
            };
        }
    });
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
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
        types: [MyInputTypeType, SomeTypeType]
    });
}
```