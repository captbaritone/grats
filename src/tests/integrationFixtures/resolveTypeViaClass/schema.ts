import DefaultNodeClass from "./models.js";
import { GraphQLSchema, GraphQLObjectType, GraphQLInterfaceType, GraphQLID, GraphQLNonNull } from "graphql";
import { node as queryNodeResolver } from "./index.js";
import { id as defaultNodeIdResolver, id as guestIdResolver, id as renamedNodeIdResolver, id as userIdResolver, Guest as GuestClass, ThisNameGetsIgnored as RenamedNodeClass, User as UserClass } from "./models.js";
export function getSchema(): GraphQLSchema {
    const GqlNodeType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "GqlNode",
        fields() {
            return {
                id: {
                    name: "id",
                    type: GraphQLID
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                node: {
                    name: "node",
                    type: GqlNodeType,
                    args: {
                        id: {
                            type: new GraphQLNonNull(GraphQLID)
                        }
                    },
                    resolve(_source, args) {
                        return queryNodeResolver(args);
                    }
                }
            };
        }
    });
    const DefaultNodeType: GraphQLObjectType = new GraphQLObjectType({
        name: "DefaultNode",
        fields() {
            return {
                id: {
                    name: "id",
                    type: GraphQLID,
                    resolve(source) {
                        return defaultNodeIdResolver(source);
                    }
                }
            };
        },
        interfaces() {
            return [GqlNodeType];
        }
    });
    const GuestType: GraphQLObjectType = new GraphQLObjectType({
        name: "Guest",
        fields() {
            return {
                id: {
                    name: "id",
                    type: GraphQLID,
                    resolve(source) {
                        return guestIdResolver(source);
                    }
                }
            };
        },
        interfaces() {
            return [GqlNodeType];
        }
    });
    const RenamedNodeType: GraphQLObjectType = new GraphQLObjectType({
        name: "RenamedNode",
        fields() {
            return {
                id: {
                    name: "id",
                    type: GraphQLID,
                    resolve(source) {
                        return renamedNodeIdResolver(source);
                    }
                }
            };
        },
        interfaces() {
            return [GqlNodeType];
        }
    });
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                id: {
                    name: "id",
                    type: GraphQLID,
                    resolve(source) {
                        return userIdResolver(source);
                    }
                }
            };
        },
        interfaces() {
            return [GqlNodeType];
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [GqlNodeType, DefaultNodeType, GuestType, QueryType, RenamedNodeType, UserType]
    });
}
export const gqlNodeClassMap = {
    DefaultNode: DefaultNodeClass,
    Guest: GuestClass,
    RenamedNode: RenamedNodeClass,
    User: UserClass
};
