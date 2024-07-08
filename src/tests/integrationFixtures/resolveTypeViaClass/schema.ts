import { node as queryNodeResolver } from "./index";
import { Guest as GuestClass } from "./index";
import { User as UserClass } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLInterfaceType, GraphQLID, GraphQLNonNull } from "graphql";
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
                            name: "id",
                            type: new GraphQLNonNull(GraphQLID)
                        }
                    },
                    resolve(source, args) {
                        return queryNodeResolver(source, args);
                    }
                }
            };
        }
    });
    const GuestType: GraphQLObjectType = new GraphQLObjectType({
        name: "Guest",
        fields() {
            return {
                id: {
                    name: "id",
                    type: GraphQLID
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
                    type: GraphQLID
                }
            };
        },
        interfaces() {
            return [GqlNodeType];
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [GqlNodeType, GuestType, QueryType, UserType]
    });
}
