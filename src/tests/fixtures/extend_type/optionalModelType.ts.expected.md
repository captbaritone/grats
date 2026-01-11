# extend_type/optionalModelType.ts

## Input

```ts title="extend_type/optionalModelType.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export function greeting(
  // A bit odd that this is optional, but it's fine, since we will always call
  // it with a non-null value
  q?: SomeType,
): string {
  if (q == null) {
    return "Out!";
  }
  return "Hello world!";
}
```

## Output

### SDL

```graphql
type SomeType {
  greeting: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greeting as someTypeGreetingResolver } from "./optionalModelType";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                greeting: {
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