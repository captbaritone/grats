## input

```ts title="default_values/DefaultArgumentPropertyName.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ if: x = false }: { if: boolean }): string {
    return x ? "hello" : "world";
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  hello(if: Boolean! = false): String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLBoolean } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    args: {
                        if: {
                            type: new GraphQLNonNull(GraphQLBoolean),
                            defaultValue: false
                        }
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```