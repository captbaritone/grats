## input

```ts title="extend_type/fieldAsExportedArrowFunction.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export const greeting = (_: SomeType): string => {
  return `Hello World`;
};
```

## Output

```
-- SDL --
type SomeType {
  greeting: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greeting as someTypeGreetingResolver } from "./fieldAsExportedArrowFunction";
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