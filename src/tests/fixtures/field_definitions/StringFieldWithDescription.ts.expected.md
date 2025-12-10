## input

```ts title="field_definitions/StringFieldWithDescription.ts"
/** @gqlType */
export default class SomeType {
  /**
   * Greet the world!
   * @gqlField
   */
  hello(): string {
    return "Hello world!";
  }
}
```

## Output

```
-- SDL --
type SomeType {
  """Greet the world!"""
  hello: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    description: "Greet the world!",
                    name: "hello",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```