import { alwaysThrows as queryAlwaysThrowsResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                alwaysThrows: {
                    name: "alwaysThrows",
                    type: GraphQLString,
                    resolve(source) {
                        return queryAlwaysThrowsResolver(source);
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
export { getSchema };
