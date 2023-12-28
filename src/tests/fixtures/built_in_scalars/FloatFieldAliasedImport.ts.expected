-----------------
INPUT
----------------- 
import { Float as LocalFloat } from "../../../Types";

/** @gqlType */
export default class SomeType {
  /** @gqlField */
  ratio(): LocalFloat {
    return 10;
  }
}

-----------------
OUTPUT
-----------------
-- SDL --
type SomeType {
  ratio: Float
}
-- TypeScript --
import { GraphQLSchema, GraphQLObjectType, GraphQLFloat } from "graphql";
export function getSchema(): GraphQLSchema {
    const SomeTypeType: GraphQLObjectType = new GraphQLObjectType({
        name: "SomeType",
        fields() {
            return {
                ratio: {
                    name: "ratio",
                    type: GraphQLFloat
                }
            };
        }
    });
    return new GraphQLSchema({
        types: [SomeTypeType]
    });
}
