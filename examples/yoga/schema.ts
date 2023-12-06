import { GraphQLSchema, GraphQLObjectType, GraphQLNonNull, GraphQLList, GraphQLString, GraphQLInterfaceType } from "graphql";
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
                type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(UserType)))
            },
            me: {
                name: "me",
                type: new GraphQLNonNull(UserType)
            },
            person: {
                name: "person",
                type: new GraphQLNonNull(IPersonType)
            }
        };
    }
});
const schema = new GraphQLSchema({
    query: QueryType
});
export { schema };
