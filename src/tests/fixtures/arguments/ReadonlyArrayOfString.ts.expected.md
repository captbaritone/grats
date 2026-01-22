# arguments/ReadonlyArrayOfString.ts

## Input

```ts title="arguments/ReadonlyArrayOfString.ts"
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greetings: readonly string[]): string {
    return `${greetings.join(", ")} world!`;
  }
}
```

## Output

### SDL

```graphql
type SomeType {
  hello(greetings: [String!]!): String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLList } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    args: {
                        greetings: {
                            type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString)))
                        }
                    },
                    resolve(source, args) {
                        return source.hello(args.greetings);
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