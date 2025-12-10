## input

```ts title="default_values/DefaultArgumentObjectLiteral.ts"
import { Int } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  someField1({
    input = { first: 10, offset: 100 },
  }: {
    input?: ConnectionInput | null;
  }): string {
    return "hello";
  }
}

/** @gqlInput */
type ConnectionInput = {
  first: Int;
  offset: Int;
};
```

## Output

### SDL

```graphql
input ConnectionInput {
  first: Int!
  offset: Int!
}

type SomeType {
  someField1(input: ConnectionInput = {first: 10, offset: 100}): String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInputObjectType, GraphQLNonNull, GraphQLInt, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const ConnectionInputType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "ConnectionInput",
        fields() {
            return {
                first: {
                    name: "first",
                    type: new GraphQLNonNull(GraphQLInt)
                },
                offset: {
                    name: "offset",
                    type: new GraphQLNonNull(GraphQLInt)
                }
            };
        }
    });
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                someField1: {
                    name: "someField1",
                    type: GraphQLString,
                    args: {
                        input: {
                            type: ConnectionInputType,
                            defaultValue: {
                                first: 10,
                                offset: 100
                            }
                        }
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [ConnectionInputType, SomeTypeType]
    });
}
```