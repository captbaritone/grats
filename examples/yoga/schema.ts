/**
 * Executable schema generated by Grats (https://grats.capt.dev)
 * Do not manually edit. Regenerate by running `npx grats`.
 */
import UserClass from "./models/User";
import queryAllUsersResolver from "./models/User";
import queryMeResolver from "./models/User";
import { person as queryPersonResolver } from "./interfaces/IPerson";
import { countdown as subscriptionCountdownResolver } from "./Subscription";
import { GraphQLSchema, GraphQLObjectType, GraphQLNonNull, GraphQLList, GraphQLString, GraphQLInterfaceType, GraphQLInt } from "graphql";
export function getSchema(): GraphQLSchema {
    const GroupType: GraphQLObjectType = new GraphQLObjectType({
        name: "Group",
        fields() {
            return {
                description: {
                    name: "description",
                    type: new GraphQLNonNull(GraphQLString)
                },
                members: {
                    name: "members",
                    type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType)))
                },
                name: {
                    name: "name",
                    type: new GraphQLNonNull(GraphQLString)
                }
            };
        }
    });
    const IPersonType: GraphQLInterfaceType = new GraphQLInterfaceType({
        name: "IPerson",
        fields() {
            return {
                name: {
                    name: "name",
                    type: new GraphQLNonNull(GraphQLString)
                }
            };
        },
        resolveType
    });
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                groups: {
                    name: "groups",
                    type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GroupType)))
                },
                name: {
                    name: "name",
                    type: new GraphQLNonNull(GraphQLString)
                }
            };
        },
        interfaces() {
            return [IPersonType];
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                allUsers: {
                    name: "allUsers",
                    type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType))),
                    resolve() {
                        return queryAllUsersResolver.allUsers();
                    }
                },
                me: {
                    name: "me",
                    type: new GraphQLNonNull(UserType),
                    resolve() {
                        return queryMeResolver.me();
                    }
                },
                person: {
                    name: "person",
                    type: new GraphQLNonNull(IPersonType),
                    resolve() {
                        return queryPersonResolver();
                    }
                }
            };
        }
    });
    const SubscriptionType: GraphQLObjectType = new GraphQLObjectType({
        name: "Subscription",
        fields() {
            return {
                countdown: {
                    name: "countdown",
                    type: new GraphQLNonNull(GraphQLInt),
                    args: {
                        from: {
                            type: new GraphQLNonNull(GraphQLInt)
                        }
                    },
                    subscribe(_source, args) {
                        return subscriptionCountdownResolver(args);
                    },
                    resolve(payload) {
                        return payload;
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        subscription: SubscriptionType,
        types: [IPersonType, GroupType, QueryType, SubscriptionType, UserType]
    });
}
const typeNameMap = new Map();
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
