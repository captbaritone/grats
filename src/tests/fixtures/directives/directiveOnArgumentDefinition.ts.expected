-----------------
INPUT
----------------- 
import { Int } from "../../../Types";
/**
 * This is my custom directive.
 * @gqlDirective on ARGUMENT_DEFINITION
 */
export function max(args: { foo: Int }) {}

/**
 * All likes in the system. Note that there is no guarantee of order.
 * @gqlQueryField */
export function likes(args: {
  /** @gqlAnnotate max(foo: 10) */
  first?: Int | null;
}): string {
  return "hello";
}

-----------------
OUTPUT
-----------------
-- SDL --
"""This is my custom directive."""
directive @max(foo: Int!) on ARGUMENT_DEFINITION

type Query {
  """All likes in the system. Note that there is no guarantee of order."""
  likes(first: Int @max(foo: 10)): String
}
-- TypeScript --
import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLInt, specifiedDirectives, GraphQLObjectType, GraphQLString } from "graphql";
import { likes as queryLikesResolver } from "./directiveOnArgumentDefinition";
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
                            type: GraphQLInt,
                            extensions: {
                                grats: {
                                    directives: [{
                                            name: "max",
                                            args: {
                                                foo: 10
                                            }
                                        }]
                                }
                            }
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
                locations: [DirectiveLocation.ARGUMENT_DEFINITION],
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
