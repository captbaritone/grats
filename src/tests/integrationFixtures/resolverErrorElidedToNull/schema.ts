import { alwaysThrows as queryAlwaysThrowsResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                alwaysThrows: {
                    name: "alwaysThrows",
                    type: GraphQLString,
                    resolve(source) {
                        return queryAlwaysThrowsResolver(source);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [QueryType]
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