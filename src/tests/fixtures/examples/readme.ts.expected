-----------------
INPUT
----------------- 
/** @gqlType */
type Query = unknown;

/** @gqlField */
export function me(_: Query): UserResolver {
  return new UserResolver();
}
/**
 * @gqlField
 * @deprecated Please use `me` instead.
 */
export function viewer(_: Query): UserResolver {
  return new UserResolver();
}

/**
 * A user in our kick-ass system!
 * @gqlType User
 */
class UserResolver {
  /** @gqlField */
  name: string = "Alice";

  /** @gqlField */
  greeting(args: { salutation: string }): string {
    return `${args.salutation}, ${this.name}`;
  }
}

-----------------
OUTPUT
-----------------
-- SDL --
type Query {
  me: User
  viewer: User @deprecated(reason: "Please use `me` instead.")
}

"""A user in our kick-ass system!"""
type User {
  greeting(salutation: String!): String
  name: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull } from "graphql";
import { me as queryMeResolver, viewer as queryViewerResolver } from "./readme";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        description: "A user in our kick-ass system!",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    args: {
                        salutation: {
                            type: new GraphQLNonNull(GraphQLString)
                        }
                    }
                },
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                me: {
                    name: "me",
                    type: UserType,
                    resolve(source) {
                        return queryMeResolver(source);
                    }
                },
                viewer: {
                    deprecationReason: "Please use `me` instead.",
                    name: "viewer",
                    type: UserType,
                    resolve(source) {
                        return queryViewerResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType, UserType]
    });
}
