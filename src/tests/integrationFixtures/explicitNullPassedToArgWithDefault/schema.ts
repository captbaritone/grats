import { hello as queryHelloResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
const QueryType: GraphQLObjectType = new GraphQLObjectType({
    name: "Query",
    fields() {
        return {
            hello: {
                name: "hello",
                type: GraphQLString,
                args: {
                    someArg: {
                        name: "someArg",
                        type: GraphQLString,
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
