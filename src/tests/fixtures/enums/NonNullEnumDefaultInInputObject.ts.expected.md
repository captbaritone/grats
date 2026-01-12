# enums/NonNullEnumDefaultInInputObject.ts

## Input

```ts title="enums/NonNullEnumDefaultInInputObject.ts"
// https://github.com/captbaritone/grats/issues/174

/** @gqlEnum */
type GreetingOptions = "Hello" | "Greetings" | "Sup";

/** @gqlInput */
type GreetingInput = {
  greeting: GreetingOptions;
};

/** @gqlQueryField */
export function hello(
  input: GreetingInput = { greeting: "Greetings" },
): string {
  return `${input.greeting} World`;
}
```

## Output

### SDL

```graphql
enum GreetingOptions {
  Greetings
  Hello
  Sup
}

input GreetingInput {
  greeting: GreetingOptions!
}

type Query {
  hello(input: GreetingInput! = {greeting: Greetings}): String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLInputObjectType, GraphQLEnumType } from "graphql";
import { hello as queryHelloResolver } from "./NonNullEnumDefaultInInputObject";
export function getSchema(): GraphQLSchema {
    const GreetingOptionsType: GraphQLEnumType = new GraphQLEnumType({
        name: "GreetingOptions",
        values: {
            Greetings: {
                value: "Greetings"
            },
            Hello: {
                value: "Hello"
            },
            Sup: {
                value: "Sup"
            }
        }
    });
    const GreetingInputType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "GreetingInput",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: new GraphQLNonNull(GreetingOptionsType)
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    args: {
                        input: {
                            type: new GraphQLNonNull(GreetingInputType),
                            defaultValue: {
                                greeting: "Greetings"
                            }
                        }
                    },
                    resolve(_source, args) {
                        return queryHelloResolver(args.input);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [GreetingOptionsType, GreetingInputType, QueryType]
    });
}
```