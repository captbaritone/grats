import DefaultNodeClass from "./index";
import type TDefaultNode from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLInterfaceType, GraphQLID, GraphQLNonNull } from "graphql";
import { Guest as GuestClass, ThisNameGetsIgnored as RenamedNodeClass, User as UserClass, node as queryNodeResolver, type Guest as TGuest, type ThisNameGetsIgnored as TRenamedNode, type User as TUser } from "./index";
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
        },
        resolveType
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
    const DefaultNodeType: GraphQLObjectType = new GraphQLObjectType<TDefaultNode>({
        name: "DefaultNode",
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
    const GuestType: GraphQLObjectType = new GraphQLObjectType<TGuest>({
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
    const RenamedNodeType: GraphQLObjectType = new GraphQLObjectType<TRenamedNode>({
        name: "RenamedNode",
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
    const UserType: GraphQLObjectType = new GraphQLObjectType<TUser>({
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
        types: [GqlNodeType, DefaultNodeType, GuestType, QueryType, RenamedNodeType, UserType]
    });
}
const typeNameMap = new Map();
typeNameMap.set(DefaultNodeClass, "DefaultNode");
typeNameMap.set(GuestClass, "Guest");
typeNameMap.set(RenamedNodeClass, "RenamedNode");
typeNameMap.set(UserClass, "User");
function resolveType(obj: any): string {
    if (typeof obj.__typename === "string") {
        return obj.__typename;
    }
    let prototype = Object.getPrototypeOf(obj);
    while (prototype) {
        const name = typeNameMap.get(prototype.constructor);
        if (name != null) {
            return name;
        }
        prototype = Object.getPrototypeOf(prototype);
    }
    throw new Error("Cannot find type name.");
}
