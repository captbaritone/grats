import { promiseOfPromise as queryPromiseOfPromiseResolver, promiseOfPromisePromise as queryPromiseOfPromisePromiseResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                promiseOfPromise: {
                    name: "promiseOfPromise",
                    type: GraphQLString,
                    resolve() {
                        return queryPromiseOfPromiseResolver();
                    }
                },
                promiseOfPromisePromise: {
                    name: "promiseOfPromisePromise",
                    type: GraphQLString,
                    resolve() {
                        return queryPromiseOfPromisePromiseResolver();
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
