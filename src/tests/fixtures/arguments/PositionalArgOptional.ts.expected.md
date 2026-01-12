# arguments/PositionalArgOptional.ts

## Input

```ts title="arguments/PositionalArgOptional.ts"
/** @gqlInput */
type Greeting = {
  name: string;
  salutation: string;
};

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(greeting?: string | null): string {
    return `${greeting ?? "Hello"} World`;
  }
}
```

## Output

### SDL

```graphql
input Greeting {
  name: String!
  salutation: String!
}

type SomeType {
  hello(greeting: String): String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLInputObjectType, GraphQLNonNull, GraphQLString, GraphQLObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const GreetingType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "Greeting",
        fields() {
            return {
                name: {
                    name: "name",
                    type: new GraphQLNonNull(GraphQLString)
                },
                salutation: {
                    name: "salutation",
                    type: new GraphQLNonNull(GraphQLString)
                }
            };
        }
    });
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
                    },
                    resolve(source, args) {
                        return source.hello(args.greeting);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [GreetingType, SomeTypeType]
    });
}
```