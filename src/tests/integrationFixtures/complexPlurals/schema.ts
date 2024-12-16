import { arrayOfArrayOfPromises as queryArrayOfArrayOfPromisesResolver, arrayOfPromises as queryArrayOfPromisesResolver, asyncIterableOfArrayOfPromises as queryAsyncIterableOfArrayOfPromisesResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                arrayOfArrayOfPromises: {
                    name: "arrayOfArrayOfPromises",
                    type: new GraphQLList(new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString)))),
                    resolve() {
                        return queryArrayOfArrayOfPromisesResolver();
                    }
                },
                arrayOfPromises: {
                    name: "arrayOfPromises",
                    type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
                    resolve() {
                        return queryArrayOfPromisesResolver();
                    }
                },
                asyncIterableOfArrayOfPromises: {
                    name: "asyncIterableOfArrayOfPromises",
                    type: new GraphQLList(new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString)))),
                    resolve() {
                        return queryAsyncIterableOfArrayOfPromisesResolver();
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
