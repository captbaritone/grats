# input_types/RenamedInputType.ts

## Input

```ts title="input_types/RenamedInputType.ts"
/** @gqlType */
class SomeType {
  /** @gqlField */
  hello: string;
}

/** @gqlInput OtherName */
type MyInputType = {
  someField: string;
};
```

## Output

### SDL

```graphql
input OtherName {
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
    const OtherNameType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "OtherName",
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
        types: [OtherNameType, SomeTypeType]
    });
}
```