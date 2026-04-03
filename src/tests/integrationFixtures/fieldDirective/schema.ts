import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLString, specifiedDirectives, GraphQLObjectType, GraphQLList } from "graphql";
import { getLog as queryGetLogResolver, greeting as queryGreetingResolver, logged, doubled } from "./index.js";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                getLog: {
                    description: "Returns the log of directive invocations.",
                    name: "getLog",
                    type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
                    resolve(source) {
                        return queryGetLogResolver(source);
                    }
                },
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    extensions: {
                        grats: {
                            directives: [
                                {
                                    name: "doubled",
                                    args: {}
                                },
                                {
                                    name: "logged",
                                    args: {
                                        label: "greeting"
                                    }
                                }
                            ]
                        }
                    },
                    resolve: doubled()(logged({ label: "greeting" })(function resolve(source) {
                        return queryGreetingResolver(source);
                    }))
                }
            };
        }
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "doubled",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "Doubles the result of a string field."
            }), new GraphQLDirective({
                name: "logged",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "Logs field access before resolving.",
                args: {
                    label: {
                        type: new GraphQLNonNull(GraphQLString)
                    }
                }
            })],
        query: QueryType,
        types: [QueryType]
    });
}
