-----------------
INPUT
----------------- 
/** @gqlType */
type Page = {
  /** @gqlField */
  name: string;
};

/** @gqlType */
type Edge<T> = {
  /** @gqlField */
  node: T;
  /** @gqlField */
  cursor: string;
};

/** @gqlType */
type PageConnection = {
  /** @gqlField */
  edges: Edge<Page>[];
  /** @gqlField */
  pageInfo: PageInfo;
};

/** @gqlType */
type PageInfo = {
  /** @gqlField */
  hasNextPage: boolean;
  /** @gqlField */
  hasPreviousPage: boolean;
  /** @gqlField */
  startCursor: string;
  /** @gqlField */
  endCursor: string;
};

-----------------
OUTPUT
-----------------
-- SDL --
type Page {
  name: String
}

type PageConnection {
  edges: [PageEdge!]
  pageInfo: PageInfo
}

type PageEdge {
  cursor: String
  node: Page
}

type PageInfo {
  endCursor: String
  hasNextPage: Boolean
  hasPreviousPage: Boolean
  startCursor: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLList, GraphQLNonNull, GraphQLBoolean } from "graphql";
export function getSchema(): GraphQLSchema {
    const PageType: GraphQLObjectType = new GraphQLObjectType({
        name: "Page",
        fields() {
            return {
                name: {
                    name: "name",
                    type: GraphQLString
                }
            };
        }
    });
    const PageEdgeType: GraphQLObjectType = new GraphQLObjectType({
        name: "PageEdge",
        fields() {
            return {
                cursor: {
                    name: "cursor",
                    type: GraphQLString
                },
                node: {
                    name: "node",
                    type: PageType
                }
            };
        }
    });
    const PageInfoType: GraphQLObjectType = new GraphQLObjectType({
        name: "PageInfo",
        fields() {
            return {
                endCursor: {
                    name: "endCursor",
                    type: GraphQLString
                },
                hasNextPage: {
                    name: "hasNextPage",
                    type: GraphQLBoolean
                },
                hasPreviousPage: {
                    name: "hasPreviousPage",
                    type: GraphQLBoolean
                },
                startCursor: {
                    name: "startCursor",
                    type: GraphQLString
                }
            };
        }
    });
    const PageConnectionType: GraphQLObjectType = new GraphQLObjectType({
        name: "PageConnection",
        fields() {
            return {
                edges: {
                    name: "edges",
                    type: new GraphQLList(new GraphQLNonNull(PageEdgeType))
                },
                pageInfo: {
                    name: "pageInfo",
                    type: PageInfoType
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [PageType, PageConnectionType, PageEdgeType, PageInfoType]
    });
}
