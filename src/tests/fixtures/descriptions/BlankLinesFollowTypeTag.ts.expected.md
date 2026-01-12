# descriptions/BlankLinesFollowTypeTag.ts

## Input

```ts title="descriptions/BlankLinesFollowTypeTag.ts"
/**
 * @gqlType
 *
 *
 *
 *
 *
 */
class SomeType {
  /** @gqlField */
  name: string;
}
```

## Output

### SDL

```graphql
type SomeType {
  name: String
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
                name: {
                    name: "name",
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