import { firstHundredIntegers as queryFirstHundredIntegersResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString, GraphQLInt, GraphQLBoolean } from "graphql";
export function getSchema(): GraphQLSchema {
    const FirstHundredIntegersEdgeType: GraphQLObjectType = new GraphQLObjectType({
        name: "FirstHundredIntegersEdge",
        fields() {
            return {
                cursor: {
                    name: "cursor",
                    type: GraphQLString
                },
                node: {
                    name: "node",
                    type: GraphQLInt
                }
            };
        }
    });
    const FirstHundredIntegersPageInfoType: GraphQLObjectType = new GraphQLObjectType({
        name: "FirstHundredIntegersPageInfo",
        fields() {
            return {
                endCursor: {
                    name: "endCursor",
                    type: GraphQLString
                },
                hasNextPage: {
                    name: "hasNextPage",
                    type: new GraphQLNonNull(GraphQLBoolean)
                },
                hasPreviousPage: {
                    name: "hasPreviousPage",
                    type: new GraphQLNonNull(GraphQLBoolean)
                },
                startCursor: {
                    name: "startCursor",
                    type: GraphQLString
                }
            };
        }
    });
    const FirstHundredIntegersConnectionType: GraphQLObjectType = new GraphQLObjectType({
        name: "FirstHundredIntegersConnection",
        fields() {
            return {
                edges: {
                    name: "edges",
                    type: new GraphQLList(new GraphQLNonNull(FirstHundredIntegersEdgeType))
                },
                pageInfo: {
                    name: "pageInfo",
                    type: FirstHundredIntegersPageInfoType
                }
            };
        }
    });
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                firstHundredIntegers: {
                    name: "firstHundredIntegers",
                    type: FirstHundredIntegersConnectionType,
                    args: {
                        after: {
                            type: GraphQLString
                        },
                        first: {
                            type: GraphQLInt
                        }
                    },
                    resolve(_source, args) {
                        return queryFirstHundredIntegersResolver(args);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [FirstHundredIntegersConnectionType, FirstHundredIntegersEdgeType, FirstHundredIntegersPageInfoType, QueryType]
    });
}
