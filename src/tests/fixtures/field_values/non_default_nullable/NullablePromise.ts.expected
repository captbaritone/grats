-----------------
INPUT
----------------- 
// { "nullableByDefault": false }
/** @gqlType */
export default class SomeType {
  /** @gqlField */
  hello(): Promise<string | void> {
    return Promise.resolve("Hello world!");
  }
}

-----------------
OUTPUT
-----------------
-- SDL --
type SomeType {
  hello: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                hello: {
                    name: "hello",
                    type: GraphQLString
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
