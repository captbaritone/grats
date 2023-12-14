import { hello as queryHelloResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull } from "graphql";
const QueryType: GraphQLObjectType = new GraphQLObjectType({
    name: "Query",
    fields() {
        return {
            hello: {
                name: "hello",
                type: GraphQLString,
                args: {
                    greeting: {
                        name: "greeting",
                        type: new GraphQLNonNull(GraphQLString),
                        defaultValue: "Hello"
                    }
                },
                resolve(source, args) {
                    return queryHelloResolver(source, args);
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
