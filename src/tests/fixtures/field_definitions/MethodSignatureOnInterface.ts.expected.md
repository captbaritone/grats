## input

```ts title="field_definitions/MethodSignatureOnInterface.ts"
/** @gqlInterface */
interface ICarly {
  /** @gqlField */
  name(): string;
}
```

## Output

### SDL

```graphql
interface ICarly {
  name: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const ICarlyType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "ICarly",
        fields() {
            return {
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [ICarlyType]
    });
}
```