import { allUsers } from "./models/User";
import { me } from "./Query";
import { person } from "./Query";
import { countdown } from "./Subscription";
import { GraphQLSchema, GraphQLObjectType, GraphQLNonNull, GraphQLList, GraphQLString, GraphQLInterfaceType, GraphQLInt } from "graphql";
const GroupType: GraphQLObjectType = new GraphQLObjectType({
    name: "Group",
    fields() {
        return {
            description: {
                name: "description",
                type: new GraphQLNonNull(GraphQLString)
            },
            name: {
                name: "name",
                type: new GraphQLNonNull(GraphQLString)
            },
            members: {
                name: "members",
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType)))
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
    }
});
const UserType: GraphQLObjectType = new GraphQLObjectType({
    name: "User",
    fields() {
        return {
            name: {
                name: "name",
                type: new GraphQLNonNull(GraphQLString)
            },
            groups: {
                name: "groups",
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GroupType)))
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
                resolve(source, args, context, info) {
                    return allUsers(source, args, context, info);
                }
            },
            me: {
                name: "me",
                type: new GraphQLNonNull(UserType),
                resolve(source, args, context, info) {
                    return me(source, args, context, info);
                }
            },
            person: {
                name: "person",
                type: new GraphQLNonNull(IPersonType),
                resolve(source, args, context, info) {
                    return person(source, args, context, info);
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
                        name: "from",
                        type: new GraphQLNonNull(GraphQLInt)
                    }
                },
                resolve(source, args, context, info) {
                    return countdown(source, args, context, info);
                }
            }
        };
    }
});
const schema = new GraphQLSchema({
    query: QueryType,
    subscription: SubscriptionType
});
export { schema };
