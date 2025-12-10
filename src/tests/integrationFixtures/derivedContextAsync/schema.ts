import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { derived, User as queryCurrentUserResolver, hello as queryHelloResolver, user as queryUserResolver } from "./index";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    async resolve(source) {
                        return source.greeting(await derived());
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
                currentUser: {
                    name: "currentUser",
                    type: UserType,
                    async resolve() {
                        return queryCurrentUserResolver.currentUser(await derived());
                    }
                },
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    async resolve() {
                        return queryHelloResolver(await derived());
                    }
                },
                user: {
                    name: "user",
                    type: UserType,
                    async resolve() {
                        return queryUserResolver(await derived());
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
