import { me as queryMeResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLNonNull, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const UserType: GraphQLObjectType = new GraphQLObjectType({
        name: "User",
        fields() {
            return {
                alwaysThrowsKillsParentOnException: {
                    name: "alwaysThrowsKillsParentOnException",
                    type: new GraphQLNonNull(GraphQLString)
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
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType, UserType]
    });
}
