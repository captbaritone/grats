## input

```ts title="field_values/MaybePromise.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  b: Promise<string> | null;
}
```

## Output

```
-- SDL --
type SomeType {
  b: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                b: {
                    name: "b",
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