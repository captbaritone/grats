## input

```ts title="type_definitions_from_alias/AliasOfUnknownDefinesType.ts"
/** @gqlType */
export type SomeType = unknown;

/** @gqlField */
export function greeting(_: SomeType): string {
  return "Hello world";
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
import { greeting as someTypeGreetingResolver } from "./AliasOfUnknownDefinesType";
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