import { alwaysThrowsKillsParentOnException as queryAlwaysThrowsKillsParentOnExceptionResolver, hello as queryHelloResolver } from "./index.ts";
import { GraphQLSchema, GraphQLObjectType, GraphQLNonNull, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                alwaysThrowsKillsParentOnException: {
                    name: "alwaysThrowsKillsParentOnException",
                    type: new GraphQLNonNull(GraphQLString),
                    resolve() {
                        return queryAlwaysThrowsKillsParentOnExceptionResolver();
                    }
                },
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    resolve() {
                        return queryHelloResolver();
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
