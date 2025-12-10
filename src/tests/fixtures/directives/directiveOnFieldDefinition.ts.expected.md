## input

```ts title="directives/directiveOnFieldDefinition.ts"
import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on FIELD_DEFINITION
 */
export function max(args: { foo: Int }) {}

/**
 * All likes in the system. Note that there is no guarantee of order.
 * @gqlQueryField
 * @gqlAnnotate max(foo: 10)
 */
export function likes(args: { first?: Int | null }): string {
  return "hello";
}
```

## Output

### SDL

```graphql
"""This is my custom directive."""
directive @max(foo: Int!) on FIELD_DEFINITION

type Query {
  """All likes in the system. Note that there is no guarantee of order."""
  likes(first: Int): String @max(foo: 10)
}
```

### TypeScript

```ts
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLInt, specifiedDirectives, GraphQLObjectType, GraphQLString } from "graphql";
import { likes as queryLikesResolver } from "./directiveOnFieldDefinition";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                likes: {
                    description: "All likes in the system. Note that there is no guarantee of order.",
                    name: "likes",
                    type: GraphQLString,
                    args: {
                        first: {
                            type: GraphQLInt
                        }
                    },
                    extensions: {
                        grats: {
                            directives: [{
                                    name: "max",
                                    args: {
                                        foo: 10
                                    }
                                }]
                        }
                    },
                    resolve(_source, args) {
                        return queryLikesResolver(args);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "max",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "This is my custom directive.",
                args: {
                    foo: {
                        type: new GraphQLNonNull(GraphQLInt)
                    }
                }
            })],
        query: QueryType,
        types: [QueryType]
    });
}
```