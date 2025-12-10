## input

```ts title="extend_type/addDeprecatedField.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/**
 * @gqlField
 * @deprecated Because reasons
 */
export function greeting(query: SomeType): string {
  return "Hello world!";
}
```

## Output

### SDL

```graphql
type SomeType {
  greeting: String @deprecated(reason: "Because reasons")
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greeting as someTypeGreetingResolver } from "./addDeprecatedField";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                greeting: {
                    deprecationReason: "Because reasons",
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