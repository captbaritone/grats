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
                    resolve(source, args, context, info) {
                        return source.someOtherName(args, context, info);
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