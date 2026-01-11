# field_definitions/ParameterPropertyFieldWithDescription.ts

## Input

```ts title="field_definitions/ParameterPropertyFieldWithDescription.ts"
/** @gqlType */
export default class SomeType {
  constructor(
    /**
     * Greet the world!
     * @gqlField
     */
    public hello: string,
  ) {}
}
```

## Output

### SDL

```graphql
type SomeType {
  """Greet the world!"""
  hello: String
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
                hello: {
                    description: "Greet the world!",
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