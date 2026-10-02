# directives/gqlAnnotateOnNonGqlDocblock.ts

## Input

```ts title="directives/gqlAnnotateOnNonGqlDocblock.ts"
// Because @gqlAnnotate can go on argument definitions which don't have any
// `@gql` tag, we can't report this as an error for now.

/**
 * @gqlAnnotate max(foo: ["a", "b"])
 */
export function foo() {}

/** @gqlQueryField */
export function hello(): string {
  return "Hello";
}
```

## Output

### SDL

```graphql
type Query {
  hello: String
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { hello as queryHelloResolver } from "./gqlAnnotateOnNonGqlDocblock";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return { hello: {
                name: "hello",
                type: GraphQLString,
                resolve() {
                    return queryHelloResolver();
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