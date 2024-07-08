import { hello as queryHelloResolver } from "./index";
import { GraphQLSchema, GraphQLObjectType, GraphQLString, GraphQLNonNull, GraphQLInputObjectType } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeObjType: GraphQLInputObjectType = new GraphQLInputObjectType({
        name: "SomeObj",
        fields() {
            return {
                a: {
                    name: "a",
                    type: new GraphQLNonNull(GraphQLString)
                }
            };
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
                        someObj: {
                            name: "someObj",
                            type: new GraphQLNonNull(SomeObjType),
                            defaultValue: {
                                a: "Sup"
                            }
                        }
                    },
                    resolve(source, args) {
                        return queryHelloResolver(source, args);
                    }
                }
            };
        }
    });
    return new GraphQLSchema({
        query: QueryType,
        types: [SomeObjType, QueryType]
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