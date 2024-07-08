import DefaultNodeClass from "./index";
import { Guest as GuestClass } from "./index";
import { ThisNameGetsIgnored as RenamedNodeClass } from "./index";
import { User as UserClass } from "./index";
import { node as queryNodeResolver } from "./index";
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
    const DefaultNodeType: GraphQLObjectType = new GraphQLObjectType({
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
    const RenamedNodeType: GraphQLObjectType = new GraphQLObjectType({
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
