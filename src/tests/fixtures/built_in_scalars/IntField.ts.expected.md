## input

```ts title="built_in_scalars/IntField.ts"
import { Int } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  age(): Int {
    return 10;
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  age: Int
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLInt } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                age: {
                    name: "age",
                    type: GraphQLInt
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```