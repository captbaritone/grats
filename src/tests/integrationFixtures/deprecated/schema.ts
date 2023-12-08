import { hello as queryHelloResolver } from "./index";
import { goodBye as queryGoodByeResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
const QueryType: GraphQLObjectType = new GraphQLObjectType({
    name: "Query",
    fields() {
        return {
            hello: {
                deprecationReason: "For reasons",
                name: "hello",
                type: GraphQLString,
                resolve(source) {
                    return queryHelloResolver(source);
                }
            },
            goodBye: {
                deprecationReason: "No longer supported",
                name: "goodBye",
                type: GraphQLString,
                resolve(source) {
                    return queryGoodByeResolver(source);
                }
            }
        };
    }
});
const schema = new GraphQLSchema({
    query: QueryType,
    types: [QueryType]
});
export { schema };
