## input

```ts title="descriptions/BlankLinesAroundDescription.ts"
/**
 *
 *
 *
 *
 *
 *
 *
 *
 *
 * Sup
 *
 *
 *
 *
 *
 *
 *
 *
 * @gqlType
 */
class SomeType {
  /** @gqlField */
  name: string;
}
```

## Output

### SDL

```graphql
"""Sup"""
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
        description: "Sup",
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