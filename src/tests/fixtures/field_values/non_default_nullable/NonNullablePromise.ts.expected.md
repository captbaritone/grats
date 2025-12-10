## input

```ts title="field_values/non_default_nullable/NonNullablePromise.ts"
// { "nullableByDefault": false }
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): Promise<string> {
    return Promise.resolve("Hello world!");
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