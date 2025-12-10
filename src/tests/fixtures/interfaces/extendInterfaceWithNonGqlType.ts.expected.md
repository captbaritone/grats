## input

```ts title="interfaces/extendInterfaceWithNonGqlType.ts"
interface IThing {
  name: string;
}

/**
 * @gqlInterface
 */
export interface IPerson extends IThing {
  /** @gqlField */
  name: string;
}
```

## Output

```
-- SDL --
interface IPerson {
  name: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLInterfaceType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const IPersonType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "IPerson",
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
        types: [IPersonType]
    });
}
```