# enums/NonNullTsEnumDefault.ts

## Input

```ts title="enums/NonNullTsEnumDefault.ts"
// https://github.com/captbaritone/grats/issues/174

/** @gqlEnum */
enum GreetingOptions {
  Hello = "HELLO",
  // Note that the casing between the variant name and the value is different.
  Greetings = "GREETING",
  Sup = "SUP",
}

/** @gqlQueryField */
export function hello(
  greeting: GreetingOptions = GreetingOptions.Greetings,
): string {
  return `${greeting} World`;
}
```

## Output

### SDL

```graphql
enum GreetingOptions {
  GREETING
  HELLO
  SUP
}

type Query {
  hello(greeting: GreetingOptions! = GREETING): String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLEnumType } from "graphql";
import { hello as queryHelloResolver } from "./NonNullTsEnumDefault";
export function getSchema(): GraphQLSchema {
    const GreetingOptionsType: GraphQLEnumType = new GraphQLEnumType({
        name: "GreetingOptions",
        values: {
            GREETING: {
                value: "GREETING"
            },
            HELLO: {
                value: "HELLO"
            },
            SUP: {
                value: "SUP"
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
                            defaultValue: "GREETING"
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