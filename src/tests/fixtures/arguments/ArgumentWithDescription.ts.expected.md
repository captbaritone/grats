## input

```ts title="arguments/ArgumentWithDescription.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(args: {
    /** The greeting to use. */
    greeting: string;
  }): string {
    return `${args.greeting} world!`;
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  hello(
    """The greeting to use."""
    greeting: String!
  ): String
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
                            description: "The greeting to use.",
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