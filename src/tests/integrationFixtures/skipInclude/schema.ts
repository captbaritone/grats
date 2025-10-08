import { GraphQLSchema, GraphQLDirective, DirectiveLocation, specifiedDirectives, GraphQLObjectType, GraphQLString } from "graphql";
import { greeting as queryGreetingResolver } from "./index";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    resolve() {
                        return queryGreetingResolver();
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "CustomDirective",
                locations: [DirectiveLocation.FIELD]
            })],
        query: QueryType,
        types: [QueryType]
    });
}
