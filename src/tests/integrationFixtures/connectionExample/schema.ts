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
                            name: "after",
                            type: GraphQLString
                        },
                        first: {
                            name: "first",
                            type: GraphQLInt
                        }
                    },
                    resolve(source, args) {
                        return queryFirstHundredIntegersResolver(source, args);
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
const typeNameMap = new Map();

function resolveType(obj: any): string {
  if (typeof obj.__typename === "string") {
    return obj.__typename;
  }

  let prototype = Object.getPrototypeOf(obj);
  while (prototype) {
    const name = typeNameMap.get(prototype.constructor);
    if (name != null) {
      return name;
    }
    prototype = Object.getPrototypeOf(prototype);
  }

  throw new Error("Cannot find type name");
}