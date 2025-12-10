## input

```ts title="field_definitions/DeprecatedPropertyField.ts"
/** @gqlType */
export default class SomeType {
  /**
   * @gqlField
   * @deprecated Use something else.
   */
  hello: string;
}
```

## Output

```
-- SDL --
type SomeType {
  hello: String @deprecated(reason: "Use something else.")
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    deprecationReason: "Use something else.",
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