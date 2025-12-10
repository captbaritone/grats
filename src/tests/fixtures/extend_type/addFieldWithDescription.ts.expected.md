## input

```ts title="extend_type/addFieldWithDescription.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/**
 * Best field ever!
 * @gqlField
 */
export function greeting(_: SomeType): string {
  return "Hello world!";
}
```

## Output

### SDL

```graphql
type SomeType {
  """Best field ever!"""
  greeting: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greeting as someTypeGreetingResolver } from "./addFieldWithDescription";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                greeting: {
                    description: "Best field ever!",
                    name: "greeting",
                    type: GraphQLString,
                    resolve(source) {
                        return someTypeGreetingResolver(source);
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