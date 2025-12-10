## input

```ts title="descriptions/MultilineDescription.ts"
/**
 * ’Twas brillig, and the slithy toves
 *   Did gyre and gimble in the wabe:
 * All mimsy were the borogoves,
 *   And the mome raths outgrabe.
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
"""
’Twas brillig, and the slithy toves
  Did gyre and gimble in the wabe:
All mimsy were the borogoves,
  And the mome raths outgrabe.
"""
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
        description: "\u2019Twas brillig, and the slithy toves\n  Did gyre and gimble in the wabe:\nAll mimsy were the borogoves,\n  And the mome raths outgrabe.",
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