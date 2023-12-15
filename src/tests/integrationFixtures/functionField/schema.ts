import { hello as queryHelloResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    resolve(source) {
                        return queryHelloResolver(source);
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
