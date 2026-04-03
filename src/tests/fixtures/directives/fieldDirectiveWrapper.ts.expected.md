# directives/fieldDirectiveWrapper.ts

## Input

```ts title="directives/fieldDirectiveWrapper.ts"
import { Int, FieldDirective } from "../../../Types";

/**
 * Limits the rate of field resolution.
 * @gqlDirective on FIELD_DEFINITION
 */
export function rateLimit(args: { max: Int }): FieldDirective {
  return (next) => (source, args, context, info) => {
    return next(source, args, context, info);
  };
}

/** @gqlType */
type Query = unknown;

/**
 * All likes in the system.
 * @gqlField
 * @gqlAnnotate rateLimit(max: 10)
 */
export function likes(_: Query): string {
  return "hello";
}
```

## Output

### SDL

```graphql
"""Limits the rate of field resolution."""
directive @rateLimit(max: Int!) on FIELD_DEFINITION

type Query {
  """All likes in the system."""
  likes: String @rateLimit(max: 10)
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLInt, specifiedDirectives, GraphQLObjectType, GraphQLString } from "graphql";
import { likes as queryLikesResolver, rateLimit } from "./fieldDirectiveWrapper";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                likes: {
                    description: "All likes in the system.",
                    name: "likes",
                    type: GraphQLString,
                    extensions: {
                        grats: {
                            directives: [{
                                    name: "rateLimit",
                                    args: {
                                        max: 10
                                    }
                                }]
                        }
                    },
                    resolve: rateLimit({ max: 10 })(function resolve(source) {
                        return queryLikesResolver(source);
                    })
                }
            };
        }
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "rateLimit",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "Limits the rate of field resolution.",
                args: {
                    max: {
                        type: new GraphQLNonNull(GraphQLInt)
                    }
                }
            })],
        query: QueryType,
        types: [QueryType]
    });
}
```