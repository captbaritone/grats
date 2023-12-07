import { alwaysThrowsKillsParentOnException as queryAlwaysThrowsKillsParentOnExceptionResolver } from "./index";
import { hello as queryHelloResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLNonNull, GraphQLString } from "graphql";
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
const schema = new GraphQLSchema({
    query: QueryType,
    types: [QueryType]
});
export { schema };
