import { firstHundredIntegers as queryFirstHundredIntegersResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLNonNull, GraphQLBoolean, GraphQLString, GraphQLList, GraphQLInt } from "graphql";
const FirstHundredIntegersPageInfoType: GraphQLObjectType = new GraphQLObjectType({
    name: "FirstHundredIntegersPageInfo",
    fields() {
        return {
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
            },
            endCursor: {
                name: "endCursor",
                type: GraphQLString
            }
        };
    }
});
const FirstHundredIntegersEdgeType: GraphQLObjectType = new GraphQLObjectType({
    name: "FirstHundredIntegersEdge",
    fields() {
        return {
            node: {
                name: "node",
                type: GraphQLInt
            },
            cursor: {
                name: "cursor",
                type: GraphQLString
            }
        };
    }
});
const FirstHundredIntegersConnectionType: GraphQLObjectType = new GraphQLObjectType({
    name: "FirstHundredIntegersConnection",
    fields() {
        return {
            pageInfo: {
                name: "pageInfo",
                type: FirstHundredIntegersPageInfoType
            },
            edges: {
                name: "edges",
                type: new GraphQLList(new GraphQLNonNull(FirstHundredIntegersEdgeType))
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
                    first: {
                        name: "first",
                        type: GraphQLInt
                    },
                    after: {
                        name: "after",
                        type: GraphQLString
                    }
                },
                resolve(source, args) {
                    return queryFirstHundredIntegersResolver(source, args);
                }
            }
        };
    }
});
const schema = new GraphQLSchema({
    query: QueryType,
    types: [QueryType, FirstHundredIntegersConnectionType, FirstHundredIntegersPageInfoType, FirstHundredIntegersEdgeType]
});
export { schema };
