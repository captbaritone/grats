# field_values/AsyncPromiseField.ts

## Input

```ts title="field_values/AsyncPromiseField.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  async hello(): Promise<string> {
    return "Hello world!";
  }
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