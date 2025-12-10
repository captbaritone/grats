## input

```ts title="field_definitions/RenamedFieldWithArgs.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField greetz */
  hello(args: { greeting: string }): string {
    return `${args.greeting} world!`;
  }
}
```

## Output

```
-- SDL --
type SomeType {
  greetz(greeting: String!): String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                greetz: {
                    name: "greetz",
                    type: GraphQLString,
                    args: {
                        greeting: {
                            type: new GraphQLNonNull(GraphQLString)
                        }
                    },
                    resolve(source, args) {
                        return source.hello(args);
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