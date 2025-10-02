import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLID } from "graphql";
import { hello as queryHelloResolver } from "./index";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    args: {
                        someID: {
                            type: new GraphQLNonNull(GraphQLID)
                        }
                    },
                    resolve(_source, args) {
                        return queryHelloResolver(args);
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
