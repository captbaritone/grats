## input

```ts title="built_in_scalars/IdField.ts"
import { ID } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  id(): ID {
    return "QUERY_ID";
  }
}
```

## Output

```
-- SDL --
type SomeType {
  id: ID
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLID } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                id: {
                    name: "id",
                    type: GraphQLID
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
```