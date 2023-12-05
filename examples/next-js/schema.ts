import { greetings } from "./app/api/graphql/query";
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
const QueryType: GraphQLObjectType = new GraphQLObjectType({
    name: "Query",
    fields() {
        return {
            greetings: {
                name: "greetings",
                type: GraphQLString,
                resolve(source, args, context, info) {
                    // @ts-ignore
                    return greetings(source, args, context, info);
                }
            }
        };
    }
});
const schema = new GraphQLSchema({
    query: QueryType
});
export { schema };
