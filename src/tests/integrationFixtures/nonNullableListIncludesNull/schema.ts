import { someList as querySomeListResolver } from "./index";
import { someListOfLists as querySomeListOfListsResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                someList: {
                    name: "someList",
                    type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
                    resolve(source) {
                        return querySomeListResolver(source);
                    }
                },
                someListOfLists: {
                    name: "someListOfLists",
                    type: new GraphQLList(new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString)))),
                    resolve(source) {
                        return querySomeListOfListsResolver(source);
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