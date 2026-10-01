# descriptions/DescriptionWithGitHubHandle.ts

## Input

```ts title="descriptions/DescriptionWithGitHubHandle.ts"
/**
 * This type was added by @captbaritone!
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
"""This type was added by"""
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
    description: "This type was added by",
    fields() {
      return { name: { name: "name", type: GraphQLString } };
    },
  });
  return new GraphQLSchema({ types: [SomeTypeType] });
}
```