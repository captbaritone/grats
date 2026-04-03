import { GraphQLSchema, GraphQLDirective, DirectiveLocation, GraphQLNonNull, GraphQLString, GraphQLBoolean, specifiedDirectives, GraphQLObjectType, GraphQLList } from "graphql";
import { getLog as queryGetLogResolver, greeting as queryGreetingResolver, uppercased, logged } from "./index.js";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                getLog: {
                    description: "Returns the log of directive invocations.",
                    name: "getLog",
                    type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
                    resolve() {
                        return queryGetLogResolver();
                    }
                },
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    extensions: {
                        grats: {
                            directives: [
                                {
                                    name: "logged",
                                    args: {
                                        label: "greeting"
                                    }
                                },
                                {
                                    name: "uppercased",
                                    args: {
                                        enabled: true
                                    }
                                }
                            ]
                        }
                    },
                    resolve: logged({ label: "greeting" })(uppercased({ enabled: true })(function resolve() {
                        return queryGreetingResolver();
                    }))
                }
            };
        }
    });
    return new GraphQLSchema({
        directives: [...specifiedDirectives, new GraphQLDirective({
                name: "logged",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "Logs field access before resolving.",
                args: {
                    label: {
                        type: new GraphQLNonNull(GraphQLString)
                    }
                }
            }), new GraphQLDirective({
                name: "uppercased",
                locations: [DirectiveLocation.FIELD_DEFINITION],
                description: "Uppercases the result of a string field.",
                args: {
                    enabled: {
                        type: new GraphQLNonNull(GraphQLBoolean)
                    }
                }
            })],
        query: QueryType,
        types: [QueryType]
    });
}
