# field_values/MaybePromise.ts

## Input

```ts title="field_values/MaybePromise.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  b: Promise<string> | null;
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