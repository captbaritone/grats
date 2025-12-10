## input

```ts title="built_in_scalars/FloatFieldAliasedImport.ts"
import { Float as LocalFloat } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  ratio(): LocalFloat {
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