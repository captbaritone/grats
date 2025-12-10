## input

```ts title="arguments/OptionalNonNullableArgumentWithDefault.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello({ greeting = "Hello" }: { greeting?: string }): string {
    return `${greeting ?? "Hello"} World!`;
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  hello(greeting: String! = "Hello"): String
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
                            type: new GraphQLNonNull(GraphQLString),
                            defaultValue: "Hello"
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