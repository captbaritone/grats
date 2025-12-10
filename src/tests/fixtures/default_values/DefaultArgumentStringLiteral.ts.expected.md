## input

```ts title="default_values/DefaultArgumentStringLiteral.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting = "hello" }: { greeting: string }): string {
    return `${greeting} world!`;
  }
}
```

## Output

```
-- SDL --
type SomeType {
  hello(greeting: String! = "hello"): String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull } from "graphql";
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
                            type: new GraphQLNonNull(GraphQLString),
                            defaultValue: "hello"
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