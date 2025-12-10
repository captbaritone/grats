## input

```ts title="extend_type/addFieldWithArguments.ts"
/** @gqlType */
class SomeType {
  // No fields
}

/** @gqlField */
export function greeting(_: SomeType, args: { name: string }): string {
  return `Hello ${args.name}!`;
}
```

## Output

```
-- SDL --
type SomeType {
  greeting(name: String!): String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull } from "graphql";
import { greeting as someTypeGreetingResolver } from "./addFieldWithArguments";
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
                        return someTypeGreetingResolver(source, args);
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