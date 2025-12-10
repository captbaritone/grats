## input

```ts title="extend_type/fieldAsExportedArrowFunctionPositionalArgs.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export const greeting = (_: SomeType, name: string): string => {
  return `Hello ${name}`;
};
```

## Output

```
-- SDL --
type SomeType {
  greeting(name: String!): String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull } from "graphql";
import { greeting as someTypeGreetingResolver } from "./fieldAsExportedArrowFunctionPositionalArgs";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    args: {
                        name: {
                            type: new GraphQLNonNull(GraphQLString)
                        }
                    },
                    resolve(source, args) {
                        return someTypeGreetingResolver(source, args.name);
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