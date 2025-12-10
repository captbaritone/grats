## input

```ts title="arguments/OptionalArgument.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting?: string | null }): string {
    return `${greeting ?? "Hello"} World!`;
  }
}
```

## Output

```
-- SDL --
type SomeType {
  hello(greeting: String): String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    args: {
                        greeting: {
                            type: GraphQLString
                        }
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