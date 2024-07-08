import { arrayOfArrayOfPromises as queryArrayOfArrayOfPromisesResolver } from "./index";
import { arrayOfPromises as queryArrayOfPromisesResolver } from "./index";
import { asyncIterableOfArrayOfPromises as queryAsyncIterableOfArrayOfPromisesResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                arrayOfArrayOfPromises: {
                    name: "arrayOfArrayOfPromises",
                    type: new GraphQLList(new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString)))),
                    resolve(source) {
                        return queryArrayOfArrayOfPromisesResolver(source);
                    }
                },
                arrayOfPromises: {
                    name: "arrayOfPromises",
                    type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
                    resolve(source) {
                        return queryArrayOfPromisesResolver(source);
                    }
                },
                asyncIterableOfArrayOfPromises: {
                    name: "asyncIterableOfArrayOfPromises",
                    type: new GraphQLList(new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString)))),
                    resolve(source) {
                        return queryAsyncIterableOfArrayOfPromisesResolver(source);
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
