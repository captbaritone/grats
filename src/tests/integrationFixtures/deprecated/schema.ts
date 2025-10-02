import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { goodBye as queryGoodByeResolver, hello as queryHelloResolver } from "./index";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                goodBye: {
                    deprecationReason: "No longer supported",
                    name: "goodBye",
                    type: GraphQLString,
                    resolve() {
                        return queryGoodByeResolver();
                    }
                },
                hello: {
                    deprecationReason: "For reasons",
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
