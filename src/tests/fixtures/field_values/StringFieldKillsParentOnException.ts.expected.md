## input

```ts title="field_values/StringFieldKillsParentOnException.ts"
/** @gqlType */
export default class SomeType {
  /**
   * @gqlField
   * @killsParentOnException
   */
  hello(): string {
    return "Hello world!";
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  hello: String!
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLNonNull, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: new GraphQLNonNull(GraphQLString)
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```