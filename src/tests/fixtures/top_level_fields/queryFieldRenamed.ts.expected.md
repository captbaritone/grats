-----------------
INPUT
----------------- 
/** @gqlQueryField greeting */
export function greetz(): string {
  return "Hello world";
}

-----------------
OUTPUT
-----------------
-- SDL --
type Query {
  greeting: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { greetz as queryGreetingResolver } from "./queryFieldRenamed";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                greeting: {
                    name: "greeting",
                    type: GraphQLString,
                    resolve() {
                        return queryGreetingResolver();
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
