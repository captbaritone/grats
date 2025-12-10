## input

```ts title="field_values/BooleanField.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  haveBeenGreeted(): boolean {
    return false;
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  haveBeenGreeted: Boolean
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLBoolean } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                haveBeenGreeted: {
                    name: "haveBeenGreeted",
                    type: GraphQLBoolean
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```