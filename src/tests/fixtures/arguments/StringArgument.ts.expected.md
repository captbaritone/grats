## input

```ts title="arguments/StringArgument.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting }: { greeting: string }): string {
    return "Hello world!";
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  hello(greeting: String!): String
}
```

### TypeScript

```ts
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
                            type: new GraphQLNonNull(GraphQLString)
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