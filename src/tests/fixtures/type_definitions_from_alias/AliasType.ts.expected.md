## input

```ts title="type_definitions_from_alias/AliasType.ts"
/** @gqlType */
export type SomeType = {
  /** @gqlField */
  hello: string;
};
```

## Output

```
-- SDL --
type SomeType {
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