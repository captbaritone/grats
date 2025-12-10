## input

```ts title="field_definitions/ParameterPropertyFieldDeprecated.ts"
/** @gqlType */
export default class SomeType {
  constructor(
    /**
     * @gqlField
     * @deprecated Don't use this
     */
    public hello: string,
  ) {}
}
```

## Output

```
-- SDL --
type SomeType {
  hello: String @deprecated(reason: "Don't use this")
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    deprecationReason: "Don't use this",
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