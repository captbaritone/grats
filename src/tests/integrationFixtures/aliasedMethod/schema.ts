import { someType as querySomeTypeResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                someName: {
                    name: "someName",
                    type: GraphQLString,
                    args: {
                        greeting: {
                            name: "greeting",
                            type: new GraphQLNonNull(GraphQLString)
                        }
                    },
                    resolve(source, args, context) {
                        return source.someOtherName(args, context);
                    }
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                someType: {
                    name: "someType",
                    type: SomeTypeType,
                    resolve(source) {
                        return querySomeTypeResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType, SomeTypeType]
    });
}
