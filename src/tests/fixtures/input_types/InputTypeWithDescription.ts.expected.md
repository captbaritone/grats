# input_types/InputTypeWithDescription.ts

## Input

```ts title="input_types/InputTypeWithDescription.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: string;
}

/**
 * Check out this great input!
 * @gqlInput
 */
type MyInputType = {
  someField: string;
};
```

## Output

### SDL

```graphql
"""Check out this great input!"""
input MyInputType {
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
        description: "Check out this great input!",
        name: "MyInputType",
        fields() {
            return {
                someField: {
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