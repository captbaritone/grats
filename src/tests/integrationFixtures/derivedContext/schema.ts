import { hello as queryHelloResolver, derived } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    resolve() {
                        return queryHelloResolver(derived());
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
