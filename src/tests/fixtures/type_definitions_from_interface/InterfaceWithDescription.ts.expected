-----------------
INPUT
----------------- 
/**
 * The root of all evil.
 *
 * @gqlType
 */
export default interface SomeType {
  /** @gqlField */
  hello: string;
}

-----------------
OUTPUT
-----------------
-- SDL --
"""The root of all evil."""
type SomeType {
  hello: String
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        description: "The root of all evil.",
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
