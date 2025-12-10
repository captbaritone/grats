## input

```ts title="enums/NonNullEnumDefault.ts"
// https://github.com/captbaritone/grats/issues/174

/** @gqlEnum */
type GreetingOptions = "Hello" | "Greetings" | "Sup";

/** @gqlQueryField */
export function hello(greeting: GreetingOptions = "Greetings"): string {
  return `${greeting} World`;
}
```

## Output

```
-- SDL --
enum GreetingOptions {
  Greetings
  Hello
  Sup
}

type Query {
  hello(greeting: GreetingOptions! = Greetings): String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLEnumType } from "graphql";
import { hello as queryHelloResolver } from "./NonNullEnumDefault";
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
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    args: {
                        greeting: {
                            type: new GraphQLNonNull(GreetingOptionsType),
                            defaultValue: "Greetings"
                        }
                    },
                    resolve(_source, args) {
                        return queryHelloResolver(args.greeting);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [GreetingOptionsType, QueryType]
    });
}
```