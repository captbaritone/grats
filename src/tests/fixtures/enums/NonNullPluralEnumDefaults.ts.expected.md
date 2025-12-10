## input

```ts title="enums/NonNullPluralEnumDefaults.ts"
// https://github.com/captbaritone/grats/issues/174

/** @gqlEnum */
type GreetingOptions = "Hello" | "Greetings" | "Sup";

/** @gqlQueryField */
export function hello(
  greeting: GreetingOptions[] = ["Greetings", "Hello"],
): string {
  return `${greeting.join(", ")} World`;
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
  hello(greeting: [GreetingOptions!]! = [Greetings, Hello]): String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLList, GraphQLEnumType } from "graphql";
import { hello as queryHelloResolver } from "./NonNullPluralEnumDefaults";
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
                            type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GreetingOptionsType))),
                            defaultValue: [
                                "Greetings",
                                "Hello"
                            ]
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