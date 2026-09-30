# directives/multipleAnnotatedDirectivesWithArgs.ts

## Input

```ts title="directives/multipleAnnotatedDirectivesWithArgs.ts"
import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function max(args: { foo: Int }) {}

/**
 * @gqlQueryField
 * @gqlAnnotate max(foo: 10)
 */
export function likes(): string {
  return "hello";
}

/**
 * @gqlQueryField
 * @gqlAnnotate max(foo: 20)
 */
export function shares(): string {
  return "hello";
}
```

## Output

### SDL

```graphql
"""This is my custom directive."""
directive @max(foo: Int!) on FIELD_DEFINITION

type Query {
  likes: String @max(foo: 10)
  shares: String @max(foo: 20)
}
```

### TypeScript

```ts
import {
  GraphQLSchema,
  GraphQLDirective,
  DirectiveLocation,
  GraphQLNonNull,
  GraphQLInt,
  specifiedDirectives,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import {
  likes as queryLikesResolver,
  shares as querySharesResolver,
} from "./multipleAnnotatedDirectivesWithArgs";
export function getSchema(): GraphQLSchema {
  const QueryType: GraphQLObjectType = new GraphQLObjectType({
    name: "Query",
    fields() {
      return {
        likes: {
          name: "likes",
          type: GraphQLString,
          extensions: {
            grats: { directives: [{ name: "max", args: { foo: 10 } }] },
          },
          resolve() {
            return queryLikesResolver();
          },
        },
        shares: {
          name: "shares",
          type: GraphQLString,
          extensions: {
            grats: { directives: [{ name: "max", args: { foo: 20 } }] },
          },
          resolve() {
            return querySharesResolver();
          },
        },
      };
    },
  });
  return new GraphQLSchema({
    directives: [
      ...specifiedDirectives,
      new GraphQLDirective({
        name: "max",
        locations: [DirectiveLocation.FIELD_DEFINITION],
        description: "This is my custom directive.",
        args: { foo: { type: new GraphQLNonNull(GraphQLInt) } },
      }),
    ],
    query: QueryType,
    types: [QueryType],
  });
}
```