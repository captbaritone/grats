## input

```ts title="type_definitions_from_interface/InterfaceWithDescriptionAndCustomName.ts"
/**
 * The root of all evil.
 *
 * @gqlType SomeType
 */
export default interface NotQuery {
  /** @gqlField */
  hello: string;
}
```

## Output

### SDL

```graphql
"""The root of all evil."""
type SomeType {
  hello: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        description: "The root of all evil.",
        fields() {
            return {
                hello: {
                    name: "hello",
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