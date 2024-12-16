import { alwaysThrowsKillsParentOnException as queryAlwaysThrowsKillsParentOnExceptionResolver, hello as queryHelloResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLNonNull, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                alwaysThrowsKillsParentOnException: {
                    name: "alwaysThrowsKillsParentOnException",
                    type: new GraphQLNonNull(GraphQLString),
                    resolve(source) {
                        return queryAlwaysThrowsKillsParentOnExceptionResolver(source);
                    }
                },
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
