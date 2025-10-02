-----------------
INPUT
----------------- 
export class SomeClass {
  /** @gqlField */
  static greet(_: Query): string {
    return "Hello, world!";
  }
}

/** @gqlType */
type Query = unknown;

-----------------
OUTPUT
-----------------
-- SDL --
type Query {
  greet: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { SomeClass as queryGreetResolver } from "./FieldAsStaticClassMethodOnNonGqlClass";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greet: {
                    name: "greet",
                    type: GraphQLString,
                    resolve(source) {
                        return queryGreetResolver.greet(source);
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
