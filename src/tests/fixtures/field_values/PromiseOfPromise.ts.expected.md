# field_values/PromiseOfPromise.ts

## Input

```ts title="field_values/PromiseOfPromise.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  b: Promise<Promise<string>>;
}
```

## Output

### SDL

```graphql
type SomeType {
  b: String
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