import { goodBye as queryGoodByeResolver, hello as queryHelloResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                goodBye: {
                    deprecationReason: "No longer supported",
                    name: "goodBye",
                    type: GraphQLString,
                    resolve(source) {
                        return queryGoodByeResolver(source);
                    }
                },
                hello: {
                    deprecationReason: "For reasons",
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
