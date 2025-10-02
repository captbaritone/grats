import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull } from "graphql";
import { someType as querySomeTypeResolver } from "./index";
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
                    resolve() {
                        return querySomeTypeResolver();
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
