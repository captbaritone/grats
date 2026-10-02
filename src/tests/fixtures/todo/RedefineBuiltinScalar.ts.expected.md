# todo/RedefineBuiltinScalar.ts

## Input

```ts title="todo/RedefineBuiltinScalar.ts"
/** @gqlScalar String */
export type MyUrl = string;

/** @gqlQueryField */
export function url(): MyUrl {
  return "https://example.com";
}
```

## Output

### SDL

```graphql
type Query {
  url: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { url as queryUrlResolver } from "./RedefineBuiltinScalar";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return { url: {
                name: "url",
                type: GraphQLString,
                resolve() {
                    return queryUrlResolver();
                }
            } };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType]
    });
}
```