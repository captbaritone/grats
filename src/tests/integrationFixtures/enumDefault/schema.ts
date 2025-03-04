import { hello as queryHelloResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLEnumType } from "graphql";
export function getSchema(): GraphQLSchema {
    const GreetingOptionsType: GraphQLEnumType = new GraphQLEnumType({
        name: "GreetingOptions",
        values: {
            Greetings: {
                value: "Greetings"
            },
            Hello: {
                value: "Hello"
            },
            Sup: {
                value: "Sup"
            }
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString,
                    args: {
                        greeting: {
                            type: GreetingOptionsType
                        }
                    },
                    resolve(_source, args) {
                        return queryHelloResolver(args.greeting);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [GreetingOptionsType, QueryType]
    });
}
