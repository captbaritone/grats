## input

```ts title="field_values/ReadonlyArrayField.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): ReadonlyArray<string> {
    return ["Hello world!"];
  }
}
```

## Output

```
-- SDL --
type SomeType {
  hello: [String!]
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: new GraphQLList(new GraphQLNonNull(GraphQLString))
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```