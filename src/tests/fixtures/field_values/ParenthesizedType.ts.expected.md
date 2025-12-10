## input

```ts title="field_values/ParenthesizedType.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): (string | null)[] {
    return ["Hello world!"];
  }
}
```

## Output

```
-- SDL --
type SomeType {
  hello: [String]
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLList, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: new GraphQLList(GraphQLString)
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```