## input

```ts title="field_values/ArrayWithNullableItems.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): Array<string | null> {
    return ["Hello world!", null];
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  hello: [String]
}
```

### TypeScript

```ts
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