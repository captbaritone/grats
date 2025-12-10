## input

```ts title="field_values/OptionalProperty.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello?: string;
}
```

## Output

### SDL

```graphql
type SomeType {
  hello: String
}
```

### TypeScript

```ts
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