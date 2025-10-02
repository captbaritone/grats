-----------------
INPUT
----------------- 
/**
 * @gqlQueryField
 * @myDirective This will be ignored and assumed to be a TypeScript tag
 */
export function myQueryField(): string {
  return "myQueryField";
}

-----------------
OUTPUT
-----------------
-- SDL --
type Query {
  myQueryField: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
import { myQueryField as queryMyQueryFieldResolver } from "./undefinedDirectiveWithoutArgs";
export function getSchema(): GraphQLSchema {
    const QueryType: GraphQLObjectType = new GraphQLObjectType({
        name: "Query",
        fields() {
            return {
                myQueryField: {
                    name: "myQueryField",
                    type: GraphQLString,
                    resolve() {
                        return queryMyQueryFieldResolver();
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
