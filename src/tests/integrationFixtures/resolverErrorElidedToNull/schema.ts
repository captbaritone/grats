import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { alwaysThrows as queryAlwaysThrowsResolver } from "./index";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                alwaysThrows: {
                    name: "alwaysThrows",
                    type: GraphQLString,
                    resolve() {
                        return queryAlwaysThrowsResolver();
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
