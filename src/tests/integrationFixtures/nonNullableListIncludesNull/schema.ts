import { GraphQLSchema, GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from "graphql";
import { someList as querySomeListResolver, someListOfLists as querySomeListOfListsResolver } from "./index";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                someList: {
                    name: "someList",
                    type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
                    resolve() {
                        return querySomeListResolver();
                    }
                },
                someListOfLists: {
                    name: "someListOfLists",
                    type: new GraphQLList(new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString)))),
                    resolve() {
                        return querySomeListOfListsResolver();
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType]
    });
}
