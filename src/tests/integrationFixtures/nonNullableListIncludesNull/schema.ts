import { someList as querySomeListResolver, someListOfLists as querySomeListOfListsResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                someList: {
                    name: "someList",
                    type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
                    resolve(source) {
                        return querySomeListResolver(source);
                    }
                },
                someListOfLists: {
                    name: "someListOfLists",
                    type: new GraphQLList(new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString)))),
                    resolve(source) {
                        return querySomeListOfListsResolver(source);
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
