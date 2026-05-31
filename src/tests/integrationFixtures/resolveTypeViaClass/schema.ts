import DefaultNodeClass from "./models.js";
import { GraphQLSchema, GraphQLObjectType, GraphQLInterfaceType, GraphQLID, GraphQLNonNull } from "graphql";
import { Guest as GuestClass, ThisNameGetsIgnored as RenamedNodeClass, User as UserClass, id as defaultNodeIdResolver, id as guestIdResolver, id as renamedNodeIdResolver, id as userIdResolver } from "./models.js";
import { node as queryNodeResolver } from "./index.js";
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
export const getTypeName = resolveType;
export const gqlNodeClassMap = {
    DefaultNode: DefaultNodeClass,
    Guest: GuestClass,
    RenamedNode: RenamedNodeClass,
    User: UserClass
};
