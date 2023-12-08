import { hello as queryHelloResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLID } from "graphql";
const QueryType: GraphQLObjectType = new GraphQLObjectType({
    name: "Query",
    fields() {
        return {
            hello: {
                name: "hello",
                type: GraphQLString,
                args: {
                    someID: {
                        name: "someID",
                        type: new GraphQLNonNull(GraphQLID)
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
