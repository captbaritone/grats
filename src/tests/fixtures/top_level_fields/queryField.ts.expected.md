-----------------
INPUT
----------------- 
/** @gqlQueryField */
export function greeting(): string {
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
import { greeting as queryGreetingResolver } from "./queryField";
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
