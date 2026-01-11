# built_in_scalars/FloatField.ts

## Input

```ts title="built_in_scalars/FloatField.ts"
import { Float } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  ratio(): Float {
    return 10;
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  ratio: Float
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLFloat } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                ratio: {
                    name: "ratio",
                    type: GraphQLFloat
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```