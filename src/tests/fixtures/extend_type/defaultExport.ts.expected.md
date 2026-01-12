# extend_type/defaultExport.ts

## Input

```ts title="extend_type/defaultExport.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export default function greeting(_: SomeType): string {
  return `Hello World`;
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
import someTypeGreetingResolver from "./defaultExport";
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
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