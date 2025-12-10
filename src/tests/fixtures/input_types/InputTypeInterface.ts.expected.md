## input

```ts title="input_types/InputTypeInterface.ts"
/** @gqlInput */
interface MyInputType {
  someField: string;
}

/** @gqlType */
class User {
  /** @gqlField */
  myField(args: { input: MyInputType }): string {
    return args.input.someField;
  }
}
```

## Output

### SDL

```graphql
input MyInputType {
  someField: String!
}

type User {
  myField(input: MyInputType!): String
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
                    name: "someField",
                    type: new GraphQLNonNull(GraphQLString)
                }
            };
        }
    });
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                myField: {
                    name: "myField",
                    type: GraphQLString,
                    args: {
                        input: {
                            type: new GraphQLNonNull(MyInputTypeType)
                        }
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [MyInputTypeType, UserType]
    });
}
```