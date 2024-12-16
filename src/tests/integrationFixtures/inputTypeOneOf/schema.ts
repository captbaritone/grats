import { greet as queryGreetResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLInputObjectType, GraphQLID } from "graphql";
export function getSchema(): GraphQLSchema {
    const UserPayloadType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "UserPayload",
        fields() {
            return {
                id: {
                    name: "id",
                    type: new GraphQLNonNull(GraphQLID)
                },
                name: {
                    name: "name",
                    type: new GraphQLNonNull(GraphQLString)
                }
            };
        }
    });
    const GreetingType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "Greeting",
        fields() {
            return {
                name: {
                    name: "name",
                    type: GraphQLString
                },
                user: {
                    name: "user",
                    type: UserPayloadType
                },
                userId: {
                    name: "userId",
                    type: GraphQLID
                }
            };
        },
        isOneOf: true
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greet: {
                    name: "greet",
                    type: GraphQLString,
                    args: {
                        greeting: {
                            name: "greeting",
                            type: new GraphQLNonNull(GreetingType)
                        }
                    },
                    resolve(_source, args) {
                        return queryGreetResolver(args);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [GreetingType, UserPayloadType, QueryType]
    });
}
